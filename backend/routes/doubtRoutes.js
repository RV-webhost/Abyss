const express = require('express');
const router = express.Router();
const { askDoubt, getDoubtHistory } = require('../controllers/doubtController');

router.post('/ask', askDoubt);           // POST /api/v1/doubt/ask
router.get('/history/:videoId', getDoubtHistory); // GET /api/v1/doubt/history/video123

module.exports = router;