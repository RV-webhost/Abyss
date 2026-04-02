// src/controllers/roadmapController.js
const geminiService = require('../services/geminiService');

const roadmapController = {
  generateRoadmap: async (req, res) => {
    try {
      const { topic } = req.body;

      if (!topic) {
        return res.status(400).json({ success: false, message: "Topic is required" });
      }

      // 🧠 The "GPS Guide" Master Prompt
      const prompt = `
        You are a minimalist guide. The user needs a learning roadmap for: "${topic}".
        Cut the noise. Explain concepts like I am 5, but actions must be for a developer.
        
        RULES:
        1. Maximum 5 to 7 steps. Keep the journey short and achievable.
        2. "concept": Explain the 'Why' in EXACTLY ONE short sentence.
        3. "action": Tell them what to build or do in EXACTLY ONE short sentence.
        4. "videoQuery": A highly specific YouTube search to learn this step.
        5. "timeEstimate": Estimated time to complete (e.g., "2 Hours" or "1 Day").
        6. You MUST return ONLY a raw JSON array. Do not use markdown formatting like \`\`\`json. Start immediately with [ and end with ].
        
        JSON SCHEMA:
        [
          {
            "step": 1,
            "title": "Short Title",
            "concept": "Imagine a waiter taking an order from a table to the kitchen. That's a server.",
            "action": "Write a 10-line script that prints 'Hello World' to a local webpage.",
            "videoQuery": "Express.js hello world server",
            "timeEstimate": "2 Hours"
          }
        ]
      `;

      let aiRawResponse = await geminiService.generateAnswer(prompt);
      
      // 🛡️ BULLETPROOF PARSER: Strip out markdown blocks if the AI disobeys
      let cleanJson = aiRawResponse.replace(/```json/gi, '').replace(/```/g, '').trim();

      // Fallback: Slice exactly from the first bracket to the last bracket
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
        message: "Failed to architect the roadmap.",
        error: error.message 
      });
    }

    
  }
};

module.exports = roadmapController;