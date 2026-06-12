const Groq = require('groq-sdk');

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const groqService = {
  /**
   * Generates a streaming response from Groq.
   * Dynamically shifts temperature and system prompts if a Quiz is requested.
   */
  generateAnswerStream: async (prompt, isQuiz = false) => {
    try {
      const stream = await groq.chat.completions.create({
        // 🚨 UPGRADED MODEL: Swapped deprecated Llama 3 for the current active Llama 3.3 model
        model: "llama-3.3-70b-versatile", 
        messages: [
          { 
            role: "system", 
            content: isQuiz 
              ? "You are a strict JSON data generator. Output ONLY valid JSON array. No markdown, no conversational text." 
              : "You are an elite tutor. Output concise markdown." 
          },
          { role: "user", content: prompt }
        ],
        stream: true,
        temperature: isQuiz ? 0.1 : 0.5, 
      });
      return stream;
    } catch (error) {
      console.error("[Groq Service Error]:", error);
      throw error;
    }
  }
};

module.exports = groqService;