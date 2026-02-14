const express = require('express');
const router = express.Router();
const { createRoadmap, getRoadmap } = require('../controllers/roadmapController');

router.post('/generate', createRoadmap); // POST /api/v1/roadmap/generate
router.get('/:id', getRoadmap);          // GET /api/v1/roadmap/12345

module.exports = router;