// src/controllers/doubtController.js
const DoubtSession = require('../models/doubtSessionModel');
const geminiService = require('../services/geminiService');
const { YoutubeTranscript } = require('@danielxceron/youtube-transcript');
const stringSimilarity = require('string-similarity'); // 🟢 BROUGHT THIS BACK!

const ramStorage = {}; 

const extractVideoId = (url) => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

const timeToSeconds = (timeStr) => {
  if (!timeStr.includes(':')) return parseInt(timeStr) || 0;
  const parts = timeStr.split(':').reverse();
  let seconds = 0;
  for (let i = 0; i < parts.length; i++) {
    seconds += parseInt(parts[i]) * Math.pow(60, i);
  }
  return seconds;
};

const fetchVideoTitle = async (url) => {
  try {
    const response = await fetch(`https://www.youtube.com/oembed?url=${url}&format=json`);
    const data = await response.json();
    return data.title;
  } catch (error) {
    return "Unknown Title";
  }
};

const doubtController = {
  getAllDoubts: async (req, res) => {
    try {
      const sessions = await DoubtSession.find().sort({ createdAt: -1 });
      res.status(200).json({ success: true, count: sessions.length, data: sessions });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  createDoubt: async (req, res) => {
    try {
      const { url, timestamp, query, threadId } = req.body;

      if (!query) return res.status(400).json({ success: false, message: 'Query is required' });

      const MAX_LENGTH = 300; 
      if (query.length > MAX_LENGTH) {
        return res.status(400).json({ 
          success: false, 
          message: `Query is too long (${query.length} chars). Keep it under ${MAX_LENGTH} characters.` 
        });
      }

      // ==========================================
      // BRANCH 1: FOLLOW-UP QUESTION
      // ==========================================
      if (threadId) {
        const session = await DoubtSession.findById(threadId);
        if (!session) return res.status(404).json({ success: false, message: 'Session not found in DB' });

        // 🛡️ REPEAT FOLLOW-UP SHIELD (Prevents double-sending the same text in a thread)
        const studentMessages = session.history.filter(msg => msg.role === 'Student');
        const lastStudentMsg = studentMessages[studentMessages.length - 1];

        if (lastStudentMsg) {
            const similarity = stringSimilarity.compareTwoStrings(query.toLowerCase(), lastStudentMsg.text.toLowerCase());
            if (similarity > 0.90) { // 90% identical
                console.log("♻️ Thread Cache Hit: User repeated the exact follow-up. Saving API tokens.");
                const abyssMessages = session.history.filter(msg => msg.role === 'Abyss');
                const lastAbyssMsg = abyssMessages[abyssMessages.length - 1];
                
                return res.status(200).json({
                    success: true,
                    threadId: session._id,
                    data: { answer: lastAbyssMsg.text, isFollowUp: true, isCached: true }
                });
            }
        }

        session.history.push({ role: "Student", text: query });
        const historyString = session.history.map(msg => `${msg.role}: "${msg.text}"`).join('\n');

        const followUpPrompt = `
You are 'Abyss', an elite Pair Programmer.
Continuing a conversation about the video: "${session.videoTitle}". Paused at ${session.timestamp}.
Context: "${session.contextText}"
History:
${historyString}

Reply to the Student's latest message. Keep it conversational, helpful, and under 100 words.`;
        
        const aiResponse = await geminiService.generateAnswer(followUpPrompt);

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
      if (!url || !timestamp) return res.status(400).json({ success: false, message: 'url and timestamp required for new questions' });

      const videoId = extractVideoId(url);
      if (!videoId) return res.status(400).json({ success: false, message: 'Invalid YouTube URL' });

      // 🛡️ THE GLOBAL CACHE SHIELD (Checks DB before calling Gemini API)
      const existingSessions = await DoubtSession.find({ videoId, timestamp });
      
      if (existingSessions.length > 0) {
          for (let session of existingSessions) {
              const originalQuery = session.history[0].text; // The very first question asked
              const similarity = stringSimilarity.compareTwoStrings(query.toLowerCase(), originalQuery.toLowerCase());
              
              if (similarity > 0.85) { // 85% match threshold
                  console.log(`♻️ Global DB Cache Hit! Found similar query (${(similarity * 100).toFixed(0)}% match). Serving from MongoDB.`);
                  const originalAnswer = session.history[1].text; // The very first Abyss answer
                  
                  return res.status(200).json({
                      success: true,
                      threadId: session._id, // Assigns the user to the existing session thread!
                      data: { answer: originalAnswer, isCached: true }
                  });
              }
          }
      }

      const videoTitle = await fetchVideoTitle(url);

      if (!ramStorage[videoId]) {
        try {
          const transcript = await YoutubeTranscript.fetchTranscript(url);
          if (transcript.length === 0) throw new Error("Empty transcript");
          ramStorage[videoId] = { fetchedAt: new Date(), data: transcript };
        } catch (err) {
          ramStorage[videoId] = { fetchedAt: new Date(), data: null }; 
        }
      }

      let contextText = "No transcript context available.";
      if (ramStorage[videoId] && ramStorage[videoId].data) {
        const targetSeconds = timeToSeconds(timestamp);
        const startWindow = Math.max(0, targetSeconds - 30);
        const endWindow = targetSeconds + 30;

        const contextSegments = ramStorage[videoId].data.filter(seg => {
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
You are 'Abyss', an elite Pair Programmer.
Video: "${videoTitle}". Paused at exactly ${timestamp}.
Context: "${contextText}"
Query: "${query}"

1. Answer based on Context and Title.
2. If no context/title helps, DO NOT GUESS. Reply EXACTLY with: "FALLBACK_TRIGGERED: I don't have enough context from this exact timestamp. Could you clarify what you are looking for?"
3. Keep it under 100 words.`;

      let aiResponse = await geminiService.generateAnswer(prompt);
      
      if (aiResponse.includes("FALLBACK_TRIGGERED")) {
        aiResponse = aiResponse.replace("FALLBACK_TRIGGERED: ", "");
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
      res.status(500).json({ success: false, error: error.message });
    }
  },

  deleteDoubt: async (req, res) => {
    try {
      const session = await DoubtSession.findByIdAndDelete(req.params.id);
      if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
      res.status(200).json({ success: true, message: 'Session deleted successfully' });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
};

module.exports = doubtController;