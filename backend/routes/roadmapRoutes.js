const express = require('express');
const router = express.Router();
const roadmapController = require('../controllers/roadmapController');

// POST: Generate a new roadmap based on a topic or task
router.post('/generate', roadmapController.generateRoadmap);

module.exports = router;