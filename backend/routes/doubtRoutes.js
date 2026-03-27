const express = require('express');
const router = express.Router();
const doubtController = require('../controllers/doubtController');

// GET all doubts
router.get('/', doubtController.getAllDoubts);

// POST a new doubt
router.post('/', doubtController.createDoubt);

// DELETE a doubt by ID (Notice the /:id part)
router.delete('/:id', doubtController.deleteDoubt);

module.exports = router;