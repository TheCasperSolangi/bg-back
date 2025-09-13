const UserSessions = require('../models/userSession');
const jwt = require('jsonwebtoken');

// Create new session (called from login)
exports.createSession = async ({ token, device_type, device_name, user_agent, userId }) => {
  return await UserSessions.create({
    token,
    device_type,
    device_name,
    user_agent,
    user: userId
  });
};

// Get all sessions of logged-in user
exports.getUserSessions = async (req, res) => {
  try {
    const sessions = await UserSessions.find({ user: req.user.id })
      .select('-__v')
      .sort({ createdAt: -1 });

    res.status(200).json({ sessions });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Revoke session (delete by id)
exports.revokeSession = async (req, res) => {
  try {
    const session = await UserSessions.findOneAndDelete({
      _id: req.params.sessionId,
      user: req.user.id
    });

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    res.status(200).json({ message: 'Session revoked successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Revoke all sessions of a user (logout from all devices)
exports.revokeAllSessions = async (req, res) => {
  try {
    await UserSessions.deleteMany({ user: req.user.id });
    res.status(200).json({ message: 'All sessions revoked successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};