const mongoose = require('mongoose');

const userSessionsSchema = new mongoose.Schema({
  token: { type: String,  },
  device_type: { type: String, enum: ['ANDROID', 'IOS', 'DESKTOP'] },
  device_name: { type: String,  },
  user_agent: { type: String },
  createdAt: { type: Date, default: Date.now },
  onesignal_id: [String],
  ip_address: {type:String},
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'Auth' }
});

module.exports = mongoose.model('UserSessions', userSessionsSchema);