// src/services/geminiService.js
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

const generateAnswer = async (prompt, retries = 3, delay = 1000) => {
  try {
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    // 🚨 THE FIX: If the AI is busy (503) or rate-limited (429) and we have retries left
    if ((error.message.includes('503') || error.message.includes('429')) && retries > 0) {
      console.warn(`[Gemini Overloaded] Retrying in ${delay}ms... (${retries} attempts left)`);
      
      // Force the Node.js server to wait
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Recursively try again: subtract 1 retry, double the delay time
      return generateAnswer(prompt, retries - 1, delay * 2); 
    }
    
    // 🚨 THE GRACEFUL UI FALLBACK: If we run out of retries, send a polite message to the frontend
    console.error(`[Gemini Fatal Error]: ${error.message}`);
    throw new Error("The AI is processing a massive amount of data right now. Give it 5 seconds and ask again.");
  }
};

module.exports = { generateAnswer };