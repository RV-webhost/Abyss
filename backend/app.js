require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// 🟢 IMPORT DATABASE CONNECTION
const connectDB = require('./config/db');

const app = express();

// 🟢 EXECUTE DATABASE CONNECTION
connectDB();

app.use(express.json());
app.use(cors());

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

const authRoutes = require('./routes/authRoutes');
const roadmapRoutes = require('./routes/roadmapRoutes');
const doubtRoutes = require('./routes/doubtRoutes');

app.get('/', (req, res) => {
    res.render('index');
});

app.get('/roadmap', (req, res) => {
    res.render('roadmap');
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/roadmap', roadmapRoutes);
app.use('/api/v1/doubt', doubtRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on address http://localhost:${PORT}`);
});