// src/middleware/uploadMiddleware.js
const multer = require('multer');

// Store the incoming file as a Buffer in RAM, not on the disk.
// This is critical for high-speed serverless/cloud environments.
const storage = multer.memoryStorage();

// Strict validation: Only accept lightweight audio files extracted by the client
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
        cb(null, true);
    } else {
        cb(new Error('Invalid payload: Engine only accepts raw audio buffers.'), false);
    }
};

const upload = multer({ 
    storage, 
    limits: { 
        fileSize: 50 * 1024 * 1024 // 50MB hard limit (plenty for compressed audio)
    },
    fileFilter 
});

module.exports = upload;