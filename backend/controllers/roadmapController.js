const geminiService = require('../services/geminiService');

const roadmapController = {
  generateRoadmap: async (req, res) => {
    try {
      const { topic } = req.body;

      if (!topic) {
        return res.status(400).json({ success: false, message: "Topic is required" });
      }

      // 🧠 The Premium "Strict JSON" Master Prompt
     // 🧠 The "GPS Guide" Master Prompt
      const prompt = `
        You are a minimalist guide. The user needs a roadmap for: "${topic}".
        Your job is to cut the noise. NO paragraphs. NO overwhelming text. 
        Explain concepts as if you are talking to a 5-year-old, but the actions must be for a developer.
        
        RULES:
        1. Maximum 5 to 7 steps. Keep the journey short and achievable.
        2. "concept": Explain the 'Why' in EXACTLY ONE short sentence. (Explain it like I'm 5).
        3. "action": Tell them exactly what to build or do in EXACTLY ONE short sentence.
        4. "videoQuery": A highly specific YouTube search to learn this step.
        5. Return ONLY a valid JSON array. No conversational intro/outro.
        
        JSON SCHEMA:
        [
          {
            "step": 1,
            "title": "Short Title (e.g., Express.js Basics)",
            "concept": "Imagine a waiter taking an order from a table to the kitchen. That's a server.",
            "action": "Write a 10-line script that prints 'Hello World' to a local webpage.",
            "videoQuery": "Express.js hello world server for beginners"
          }
        ]
      `;

      const aiRawResponse = await geminiService.generateAnswer(prompt);
      
      // 🛡️ THE BULLETPROOF PARSER: 
      // This extracts ONLY the data between the first '[' and the last ']', ignoring all AI chit-chat.
      let cleanJson = aiRawResponse;
      const startIndex = cleanJson.indexOf('[');
      const endIndex = cleanJson.lastIndexOf(']');
      
      if (startIndex !== -1 && endIndex !== -1) {
        cleanJson = cleanJson.substring(startIndex, endIndex + 1);
      } else {
        throw new Error("Failed to locate JSON array in AI response");
      }

      const roadmapData = JSON.parse(cleanJson);

      res.status(200).json({
        success: true,
        topic: topic,
        steps: roadmapData
      });

    } catch (error) {
      console.error("Roadmap Generation Error:", error);
      res.status(500).json({ 
        success: false, 
        // Sending the actual error message during development helps debugging
        message: "Failed to architect the roadmap.",
        error: error.message 
      });
    }
  }
};

module.exports = roadmapController;