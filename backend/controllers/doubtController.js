// src/controllers/doubtController.js
const DoubtSession = require('../models/doubtSessionModel');
const geminiService = require('../services/geminiService');
const youtubeService = require('../services/youtubeService'); 

const timeToSeconds = (timeStr) => {
  if (!timeStr.includes(':')) return parseInt(timeStr) || 0;
  const parts = timeStr.split(':').reverse();
  let seconds = 0;
  for (let i = 0; i < parts.length; i++) {
    seconds += parseInt(parts[i]) * Math.pow(60, i);
  }
  return seconds;
};

// 🚨 The high-speed context engine
const getContextAtTimestamp = async (url, timestamp) => {
  const transcript = await youtubeService.fetchTranscript(url);
  if (!transcript || transcript.length === 0) return "No transcript context available.";

  const targetSeconds = timeToSeconds(timestamp);
  const startWindow = Math.max(0, targetSeconds - 30);
  const endWindow = targetSeconds + 30;

  const getSeconds = (seg) => {
     let timeValue = seg.offset !== undefined ? seg.offset : (seg.start !== undefined ? seg.start : 0);
     let segSeconds = parseFloat(timeValue);
     return segSeconds > 50000 ? segSeconds / 1000 : segSeconds;
  };

  let left = 0, right = transcript.length - 1, startIndex = -1;
  while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      if (getSeconds(transcript[mid]) >= startWindow) {
          startIndex = mid;
          right = mid - 1; 
      } else {
          left = mid + 1;
      }
  }

  const contextSegments = [];
  if (startIndex !== -1) {
      for (let i = startIndex; i < transcript.length; i++) {
          const currentSeconds = getSeconds(transcript[i]);
          if (currentSeconds > endWindow) break; 
          contextSegments.push(transcript[i]);
      }
  }

  return contextSegments.length > 0 ? contextSegments.map(seg => seg.text).join(' ') : "No transcript context available.";
};

const doubtController = {
  getAllDoubts: async (req, res) => {
    try {
      const sessions = await DoubtSession.find().sort({ createdAt: -1 });
      res.status(200).json({ success: true, count: sessions.length, data: sessions });
    } catch (error) {
      console.error(`[GET Doubts Error]: ${error.message}`);
      res.status(500).json({ success: false, message: "Internal server error." });
    }
  },

  createDoubt: async (req, res) => {
    try {
      const { url, timestamp, query, threadId } = req.body;

      if (!query) return res.status(400).json({ success: false, message: 'Query is required.' });

      const MAX_LENGTH = 300;
      if (query.length > MAX_LENGTH) {
        return res.status(400).json({
          success: false,
          message: `Query is too long. Keep it under ${MAX_LENGTH} characters.`
        });
      }

      // ==========================================
      // BRANCH 1: FOLLOW-UP QUESTION (Using Thread ID)
      // ==========================================
      if (threadId) {
        const session = await DoubtSession.findById(threadId);
        if (!session) return res.status(404).json({ success: false, message: 'Session not found.' });

        session.history.push({ role: "Student", text: query });
        const historyString = session.history.map(msg => `${msg.role}: "${msg.text}"`).join('\n');

        let currentContext = session.contextText;
        let currentTimestamp = session.timestamp;

        if (timestamp && timestamp !== session.timestamp) {
            currentTimestamp = timestamp;
            currentContext = await getContextAtTimestamp(session.url, currentTimestamp);
            session.timestamp = currentTimestamp;
            session.contextText = currentContext;
        }

        const followUpPrompt = `
You are 'Abyss', an elite, conversational Pair Programmer and Tutor.
Continuing a conversation about the video: "${session.videoTitle}". 
🚨 The student is currently paused at: ${currentTimestamp}.
🚨 Current Transcript Context: "${currentContext}"

History:
${historyString}

Reply to the Student's latest message naturally. Answer their question based on the CURRENT Transcript Context. Keep it under 100 words.`;

        // 🚨 STREAMING SETUP
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        let fullAiResponse = "";
        try {
            const stream = await geminiService.generateAnswerStream(followUpPrompt);
            for await (const chunk of stream) {
                const chunkText = chunk.text();
                fullAiResponse += chunkText;
                res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
            }
            // Send done signal with threadId so frontend knows what thread this belongs to
            res.write(`data: ${JSON.stringify({ done: true, threadId: session._id, isFollowUp: true })}\n\n`);
            res.end();
        } catch (error) {
            res.write(`data: ${JSON.stringify({ error: "Stream interrupted." })}\n\n`);
            res.end();
            return;
        }

        // 🚨 FIRE-AND-FORGET DB SAVE (Executes after user already gets the response)
        if (fullAiResponse) {
            session.history.push({ role: "Abyss", text: fullAiResponse });
            await session.save();
        }
        return; 
      }

      // ==========================================
      // BRANCH 2: BRAND NEW QUESTION
      // ==========================================
      if (!url || !timestamp) return res.status(400).json({ success: false, message: 'URL and timestamp required.' });

      const videoId = youtubeService.extractVideoId(url);
      if (!videoId) return res.status(400).json({ success: false, message: 'Invalid YouTube URL.' });

      const videoTitle = await youtubeService.fetchVideoTitle(url);
      
      // 🚨 Clean, 1-line context fetch using your helper
      const contextText = await getContextAtTimestamp(url, timestamp);
      
      const prompt = `
You are 'Abyss', an elite, conversational Pair Programmer and Tutor.
Video: "${videoTitle}". Paused at exactly ${timestamp}.
Transcript Context: "${contextText}"
Student's Query: "${query}"

INSTRUCTIONS:
1. SCANNABLE FORMATTING: Never output a wall of plain text. You MUST use Markdown. **Bold** key terms and concepts. Use bullet points for lists. Use \`inline code\` for syntax.
2. THE CLASSROOM RULE: Treat this like a live tutoring session. The student might ask fragmented questions like "why?" or "how?". 
3. DEDUCE FROM CONTEXT: If the query is vague, use the Context and Title to deduce what they are pointing at.
4. THE CONVERSATIONAL SAVE: If the query is vague AND the Context is missing, ask a natural follow-up to get them to clarify.
5. MULTIMODAL CAPABILITY: If explaining a visual/complex concept, trigger an image search by inserting exactly: \\ within your text. Replace <subject> with the specific item. 
6. NO REPETITIVE OUTROS: Answer the question and stop. Do NOT introduce yourself repeatedly. Do NOT end every message by reminding the student you are a pair programmer or offering to code a simulation.
7. Keep the tone encouraging, direct, and under 100 words.`;

      // 🚨 STREAMING SETUP
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      let fullAiResponse = "";
      try {
          const stream = await geminiService.generateAnswerStream(prompt);
          for await (const chunk of stream) {
              const chunkText = chunk.text();
              fullAiResponse += chunkText;
              res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
          }
      } catch (error) {
          res.write(`data: ${JSON.stringify({ error: "Stream interrupted." })}\n\n`);
          res.end();
          return;
      }

      // 🚨 FIRE-AND-FORGET DB SAVE 
      if (fullAiResponse) {
          const newSession = await DoubtSession.create({
            videoTitle, videoId, url, timestamp, contextText,
            history: [ { role: "Student", text: query }, { role: "Abyss", text: fullAiResponse } ]
          });
          // Send the new threadId as the final chunk
          res.write(`data: ${JSON.stringify({ done: true, threadId: newSession._id })}\n\n`);
      } else {
          res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      }
      res.end();

    } catch (error) {
      console.error(`[Create Doubt Error]: ${error.message}`);
      // Only send 500 if headers haven't been sent yet
      if (!res.headersSent) {
          res.status(500).json({ success: false, message: "Internal server error processing doubt." });
      } else {
          res.end();
      }
    }
  },

  deleteDoubt: async (req, res) => {
    try {
      const session = await DoubtSession.findByIdAndDelete(req.params.id);
      if (!session) return res.status(404).json({ success: false, message: 'Session not found.' });
      res.status(200).json({ success: true, message: 'Session deleted successfully.' });
    } catch (error) {
      console.error(`[Delete Doubt Error]: ${error.message}`);
      res.status(500).json({ success: false, message: "Internal server error." });
    }
  }
};

module.exports = doubtController;