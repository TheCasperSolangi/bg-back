const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getUserSessions,
  revokeSession,
  revokeAllSessions
} = require('../controllers/sessionController');

// Get all sessions of current user
router.get('/', protect, getUserSessions);

// Revoke one session
router.delete('/:sessionId', protect, revokeSession);

// Revoke all sessions
router.delete('/', protect, revokeAllSessions);

module.exports = router;