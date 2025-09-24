const mongoose = require('mongoose');
const vendorScopePlugin = require('../plugin/vendorScopePlugin');
const AuthSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  email:    { type: String, unique: true, required: true },
  vendor_code: { type: String, index: true },
  password: { type: String, required: true },
  user_type:{ type: String, enum: ['admin', 'user', 'guest'], default: 'user' }
});
AuthSchema.plugin(vendorScopePlugin);

module.exports = mongoose.model('Auth', AuthSchema);