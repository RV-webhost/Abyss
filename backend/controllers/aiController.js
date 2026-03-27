// backend/controllers/aiController.js
exports.getDoubtResponse = async (req, res) => {
    try {
        const { query, timestamp, videoId } = req.body;
        // This is where we call the Gemini API logic you built earlier!
        const aiResponse = `I see you have a question at ${timestamp}...`; 
        
        res.status(200).json({ success: true, answer: aiResponse });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};