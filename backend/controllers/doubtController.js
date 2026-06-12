// src/controllers/doubtController.js
const DoubtSession = require('../models/doubtSessionModel');
const geminiService = require('../services/geminiService');
const groqService = require('../services/groqService'); 

// ==========================================
// UTILITY HELPERS 
// ==========================================

const extractVideoId = (url) => {
  if (!url) return `live_session_${Date.now()}`;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : `live_session_${Date.now()}`;
};

const fetchVideoTitle = async (url) => {
  if (!url || !url.includes("youtu")) return "Live Media Session";
  try {
    const response = await fetch(`https://www.youtube.com/oembed?url=${url}&format=json`);
    const data = await response.json();
    return data.title || "Live Media Session";
  } catch (error) {
    return "Live Media Session";
  }
};

// 🚨 NEW HELPER: Protects Groq's 8K token limit by only grabbing the most recent context
const getRecentContext = (text, maxWords = 2000) => {
  if (!text) return "";
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(-maxWords).join(' ');
};

// ==========================================
// MAIN CONTROLLER ARCHITECTURE
// ==========================================

const doubtController = {
  
  getAllDoubts: async (req, res) => {
    try {
      const userId = req.user._id; 
      const sessions = await DoubtSession.find({ userId }).sort({ createdAt: -1 });
      res.status(200).json({ success: true, count: sessions.length, data: sessions });
    } catch (error) {
      res.status(500).json({ success: false, message: "Internal server error." });
    }
  },

  createDoubt: async (req, res) => {
    try {
      const { url, timestamp, query, threadId, contextText } = req.body;
      const userId = req.user._id; 

      if (!query) return res.status(400).json({ success: false, message: 'Query is required.' });

      const safeContext = (contextText && contextText.trim() !== "") 
        ? contextText 
        : "No live audio detected at this specific moment.";

      let session;

      if (threadId) {
        session = await DoubtSession.findOne({ _id: threadId, userId });
        if (!session) return res.status(404).json({ success: false, message: 'Session not found.' });
      } else {
        const videoId = extractVideoId(url);
        const videoTitle = await fetchVideoTitle(url);
        session = await DoubtSession.create({
          userId, videoTitle, videoId, url: url || "live-audio", timestamp,
          fullTranscript: [], isMediaProcessed: true, history: []
        });
      }

      session.timestamp = timestamp;
      session.contextText = safeContext;

      const historyString = session.history.map(msg => `${msg.role}: "${msg.text}"`).join('\n');
      session.history.push({ role: "Student", text: query });

      // ==========================================
      // 🚨 THE SMART ROUTER LOGIC
      // ==========================================
      
      const contextWordCount = safeContext.split(/\s+/).length;
      const isQuizRequest = /quiz|test|mcq|questions/i.test(query);
      
      // Route the CONVERSATION engine based on size (Groq crashes around ~5000+ words due to 8k token limit)
      const convoEngine = contextWordCount > 4000 ? "gemini" : "groq";

      console.log(`🚦 Router: Context size is ${contextWordCount} words. Using ${convoEngine.toUpperCase()} for conversation.`);
      if (isQuizRequest) console.log(`🚦 Router: Quiz requested. Will trigger GROQ secondary agent.`);

      const basePrompt = `
You are 'Abyss', an elite Pair Programmer and Tutor.
Video: "${session.videoTitle}". Paused at: ${timestamp}.
Live Audio Context: "${safeContext}"

History:
${historyString}

Student's Query: "${query}"

INSTRUCTIONS: Answer the query directly using Markdown. Keep it concise. Do NOT write a multiple-choice quiz in this step.
`;

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      let fullAiResponse = "";

      try {
        // ==========================================
        // STEP 1: CONVERSATION STREAMING
        // ==========================================
        if (convoEngine === "gemini") {
          const stream = await geminiService.generateAnswerStream(basePrompt);
          for await (const chunk of stream) {
            const text = chunk.text();
            fullAiResponse += text;
            res.write(`data: ${JSON.stringify({ text })}\n\n`);
          }
        } else {
          const stream = await groqService.generateAnswerStream(basePrompt, false);
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content || '';
            fullAiResponse += text;
            res.write(`data: ${JSON.stringify({ text })}\n\n`);
          }
        }

        // ==========================================
        // STEP 2: QUIZ RELAY (Strictly Groq)
        // ==========================================
        if (isQuizRequest) {
          // Truncate context to protect Groq's memory limit
          const recentContext = getRecentContext(safeContext, 2000);
          
          const quizPrompt = `
Context: "${recentContext}"
Generate a 2-question multiple-choice quiz based on this text. Output ONLY this exact JSON format. No markdown blocks.

[QUIZ: [
  {
    "question": "Q?",
    "options": ["A", "B", "C", "D"],
    "correctIndex": 0,
    "explanation": "Exp."
  }
]]`;
          
          // Stream the JSON from Groq directly after the conversation finishes
          const quizStream = await groqService.generateAnswerStream(quizPrompt, true);
          for await (const chunk of quizStream) {
            const text = chunk.choices[0]?.delta?.content || '';
            fullAiResponse += text;
            res.write(`data: ${JSON.stringify({ text })}\n\n`);
          }
        }

        // Close stream
        res.write(`data: ${JSON.stringify({ done: true, threadId: session._id, isFollowUp: !!threadId })}\n\n`);
        res.end();

      } catch (error) {
        console.error("AI Routing Stream Error:", error);
        res.write(`data: ${JSON.stringify({ error: "Stream interrupted. Router failed." })}\n\n`);
        res.end();
        return;
      }

      // Persist full combined response to history
      if (fullAiResponse) {
        session.history.push({ role: "Abyss", text: fullAiResponse });
        await session.save();
      }

    } catch (error) {
      console.error(`[Router Critical Error]: ${error.message}`);
      if (!res.headersSent) res.status(500).json({ success: false, message: "Internal routing error." });
      else res.end();
    }
  },

  deleteDoubt: async (req, res) => {
    try {
      const userId = req.user._id; 
      const session = await DoubtSession.findOneAndDelete({ _id: req.params.id, userId });
      if (!session) return res.status(404).json({ success: false, message: 'Session not found.' });
      res.status(200).json({ success: true, message: 'Session detached.' });
    } catch (error) {
      res.status(500).json({ success: false, message: "Internal server error." });
    }
  }
};

module.exports = doubtController;