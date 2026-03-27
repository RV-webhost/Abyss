// src/models/doubtSessionModel.js
const mongoose = require('mongoose');

// Schema for individual messages in the chat history
const messageSchema = new mongoose.Schema({
    role: { 
        type: String, 
        enum: ['Student', 'Abyss'], 
        required: true 
    },
    text: { 
        type: String, 
        required: true 
    }
}, { _id: false }); // We don't need a separate Mongo ID for every single text bubble

// Main schema for the Chat Session
const doubtSessionSchema = new mongoose.Schema({
    videoTitle: { type: String, required: true },
    videoId: { type: String, required: true },
    url: { type: String, required: true },
    timestamp: { type: String, required: true },
    contextText: { type: String, default: "No transcript context available." },
    history: [messageSchema] // This array stores the back-and-forth chat
}, { timestamps: true });

module.exports = mongoose.model('DoubtSession', doubtSessionSchema);