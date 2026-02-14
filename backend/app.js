const express = require('express');
const cors = require('cors');
const app = express();

// --- 1. Middlewares ---
app.use(express.json()); // Allows parsing JSON body from Frontend
app.use(cors());         // Allows Frontend to talk to Backend

// --- 2. Import Routes ---
const authRoutes = require('./routes/authRoutes');
const roadmapRoutes = require('./routes/roadmapRoutes');
const doubtRoutes = require('./routes/doubtRoutes');

// --- 3. Mount Routes (REST API Structure) ---
// All auth routes will start with /api/v1/auth
app.use('/api/v1/auth', authRoutes);

// All roadmap routes will start with /api/v1/roadmap
app.use('/api/v1/roadmap', roadmapRoutes);

// All doubt routes will start with /api/v1/doubt
app.use('/api/v1/doubt', doubtRoutes);

// --- 4. Base Route for Testing ---
app.get('/', (req, res) => {
    res.send('API is running...');
});

module.exports = app;