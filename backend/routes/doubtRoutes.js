// src/routes/doubtRoutes.js
const express = require('express');
const router = express.Router();
const doubtController = require('../controllers/doubtController');
const { protect } = require('../middleware/authMiddleware');

// Force ALL routes in this file to pass through the auth middleware.
router.use(protect); 

// GET all doubts (Now securely fetching only the logged-in user's doubts)
router.get('/', doubtController.getAllDoubts);

// POST a new doubt (The main AI streaming pipeline using live WebRTC context)
router.post('/', doubtController.createDoubt);

// DELETE a doubt by ID
router.delete('/:id', doubtController.deleteDoubt);

module.exports = router;