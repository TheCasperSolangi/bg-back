const mongoose = require('mongoose');
const vendorScopePlugin = require('../plugin/vendorScopePlugin')
const userSessionsSchema = new mongoose.Schema({
  token: { type: String,  },
  device_type: { type: String, enum: ['ANDROID', 'IOS', 'DESKTOP'] },
  device_name: { type: String,  },
  user_agent: { type: String },
  vendor_code: { type: String, index: true },
  createdAt: { type: Date, default: Date.now },
  onesignal_id: [String],
  ip_address: {type:String},
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'Auth' }
});
userSessionsSchema.plugin(vendorScopePlugin)
module.exports = mongoose.model('UserSessions', userSessionsSchema);