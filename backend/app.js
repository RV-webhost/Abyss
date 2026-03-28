require('dotenv').config();
const express = require('express');
const cors = require('cors');

// 🟢 IMPORT DATABASE CONNECTION
const connectDB = require('./config/db');

const app = express();

// 🟢 EXECUTE DATABASE CONNECTION
connectDB();

app.use(express.json());

// 🚨 THE CORS SHIELD: Locks down your API so only your React frontend can talk to it
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173', // Local Vite port or Live Render URL
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// 🟢 API ROUTES
const authRoutes = require('./routes/authRoutes');
const roadmapRoutes = require('./routes/roadmapRoutes');
const doubtRoutes = require('./routes/doubtRoutes');

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/roadmap', roadmapRoutes);
app.use('/api/v1/doubt', doubtRoutes);

// 🚨 RENDER HEALTH CHECK: Render looks at the '/' route to see if your server successfully started.
app.get('/', (req, res) => {
    res.status(200).json({ message: "Abyss API Engine is online and operational." });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});