const mongoose = require('mongoose');

const userSessionsSchema = new mongoose.Schema({
  token: { type: String, required: true },
  device_type: { type: String, enum: ['ANDROID', 'IOS', 'DESKTOP'] },
  device_name: { type: String, required: true },
  user_agent: { type: String },
  createdAt: { type: Date, default: Date.now },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'Auth', required: true }
});

module.exports = mongoose.model('UserSessions', userSessionsSchema);