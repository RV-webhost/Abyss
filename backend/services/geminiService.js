// src/services/geminiService.js
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// Note: 'gemini-1.5-flash' is the standard naming convention for the latest flash model
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const generateAnswerStream = async (prompt, retries = 3, delay = 1000) => {
  try {
    // 🚨 THE UPGRADE: We request a continuous stream instead of one massive block of text
    const result = await model.generateContentStream(prompt);
    
    // We return the raw stream object so the controller can pipe it to the frontend
    return result.stream; 
    
  } catch (error) {
    // 🚨 We keep your excellent retry logic. If the API is busy trying to open the stream, we wait and retry.
    if ((error.message.includes('503') || error.message.includes('429')) && retries > 0) {
      console.warn(`[Gemini Overloaded] Retrying stream connection in ${delay}ms... (${retries} attempts left)`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      
      return generateAnswerStream(prompt, retries - 1, delay * 2); 
    }
    
    console.error(`[Gemini Stream Fatal Error]: ${error.message}`);
    throw new Error("The AI is experiencing heavy traffic right now. Give it 5 seconds and ask again.");
  }
};

module.exports = { generateAnswerStream };