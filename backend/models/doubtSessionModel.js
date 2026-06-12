// src/models/doubtSessionModel.js
const mongoose = require('mongoose');

// Schema for ASR-generated transcript chunks
const transcriptSegmentSchema = new mongoose.Schema({
    text: { type: String, required: true },
    start: { type: Number, required: true },
    end: { type: Number, required: true },
    offset: { type: Number, required: true } // Preserved for backward compatibility with your time calculations
}, { _id: false });

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
}, { _id: false });

// Main schema for the Chat Session
const doubtSessionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true // State Hardening: Enforces strict data tenancy and session isolation
    },
    videoTitle: { type: String, required: true },
    videoId: { type: String, required: true },
    url: { type: String, required: true },
    timestamp: { type: String, required: true },
    contextText: { type: String, default: "No transcript context available." },
    
    // Cache the complete Deepgram/Whisper output array directly within the document
    fullTranscript: [transcriptSegmentSchema], 
    
    // Engine flag to check if we need to re-run the ASR pipeline or use cached data
    isMediaProcessed: { type: Boolean, default: false },
    
    history: [messageSchema] 
}, { timestamps: true });

// COMPOUND INDEXES FOR SYSTEM PERFORMANCE
// Optimizes user session retrieval while preserving creation timeline order
doubtSessionSchema.index({ userId: 1, createdAt: -1 });

// Speeds up checking if a video asset has already been transcribed by another session
doubtSessionSchema.index({ videoId: 1 });

module.exports = mongoose.model('DoubtSession', doubtSessionSchema);