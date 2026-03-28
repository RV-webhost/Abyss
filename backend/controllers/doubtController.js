// src/controllers/doubtController.js
const DoubtSession = require('../models/doubtSessionModel');
const geminiService = require('../services/geminiService');
const youtubeService = require('../services/youtubeService'); // 🚨 Cleanly importing the new service

// We keep this helper here because it is specific to processing the frontend timestamp
const timeToSeconds = (timeStr) => {
  if (!timeStr.includes(':')) return parseInt(timeStr) || 0;
  const parts = timeStr.split(':').reverse();
  let seconds = 0;
  for (let i = 0; i < parts.length; i++) {
    seconds += parseInt(parts[i]) * Math.pow(60, i);
  }
  return seconds;
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

        const followUpPrompt = `
You are 'Abyss', an elite, conversational Pair Programmer and Tutor.
Continuing a conversation about the video: "${session.videoTitle}". Paused at ${session.timestamp}.
Context: "${session.contextText}"
History:
${historyString}

Reply to the Student's latest message naturally. Ask for clarification if needed. Keep it under 100 words.`;

        let aiResponse = await geminiService.generateAnswer(followUpPrompt);
        if (!aiResponse) aiResponse = "I missed that. Could you rephrase your question?";

        session.history.push({ role: "Abyss", text: aiResponse });
        await session.save();

        return res.status(200).json({
          success: true,
          threadId: session._id,
          data: { answer: aiResponse, isFollowUp: true }
        });
      }

      // ==========================================
      // BRANCH 2: BRAND NEW QUESTION
      // ==========================================
      if (!url || !timestamp) return res.status(400).json({ success: false, message: 'URL and timestamp required.' });

      // 🚨 Using your new youtubeService for clean extraction
      const videoId = youtubeService.extractVideoId(url);
      if (!videoId) return res.status(400).json({ success: false, message: 'Invalid YouTube URL.' });

      const videoTitle = await youtubeService.fetchVideoTitle(url);

      let contextText = "No transcript context available.";
      
      // 🚨 Calling the speed-fixed transcript scraper from your service
      const transcript = await youtubeService.fetchTranscript(url);

      if (transcript && transcript.length > 0) {
          const targetSeconds = timeToSeconds(timestamp);
          const startWindow = Math.max(0, targetSeconds - 30);
          const endWindow = targetSeconds + 30;

          // Sliding window algorithm to grab exactly what is on screen
          const contextSegments = transcript.filter(seg => {
            let timeValue = seg.offset !== undefined ? seg.offset : (seg.start !== undefined ? seg.start : 0);
            let segSeconds = parseFloat(timeValue);
            if (segSeconds > 50000) segSeconds = segSeconds / 1000;
            return (segSeconds >= startWindow && segSeconds <= endWindow);
          });

          if (contextSegments.length > 0) {
            contextText = contextSegments.map(seg => seg.text).join(' ');
          }
      }
      
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

      let aiResponse = await geminiService.generateAnswer(prompt);
      
      // Failsafe so we never save an empty string to MongoDB
      if (!aiResponse) {
          aiResponse = "I'm having trouble processing that right now. Can you try asking again?";
      }

      const newSession = await DoubtSession.create({
        videoTitle, videoId, url, timestamp, contextText,
        history: [ { role: "Student", text: query }, { role: "Abyss", text: aiResponse } ]
      });

      res.status(201).json({
        success: true,
        threadId: newSession._id,
        data: { answer: aiResponse }
      });

    } catch (error) {
      console.error(`[Create Doubt Error]: ${error.message}`);
      res.status(500).json({ success: false, message: "Internal server error processing doubt." });
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