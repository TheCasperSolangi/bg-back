const mongoose = require('mongoose');
const vendorScopePlugin = require('../plugin/vendorScopePlugin');
const userSessionsSchema = new mongoose.Schema({
  token: { type: String, required: true },
  device_type: { type: String, enum: ['ANDROID', 'IOS', 'DESKTOP'] },
  vendor_code: { type: String, index: true },
  device_name: { type: String, required: true },
  user_agent: { type: String },
  createdAt: { type: Date, default: Date.now },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'Auth', required: true }
});
userSessionsSchema.plugin(vendorScopePlugin);
module.exports = mongoose.model('UserSessions', userSessionsSchema);