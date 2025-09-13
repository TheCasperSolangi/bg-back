const mongoose = require('mongoose');

const guestSessionSchema = new mongoose.Schema({
  session_id: { type: String, required: true, unique: true },
  ip_address: String,
  user_agent: String,
  android_id: String,
  device_type: String,
  brand: String,
  model: String,
  platform: String,
  platformVersion: String,
  cart_code: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: '7d' } // auto delete after 7 days
});

module.exports = mongoose.model('GuestSession', guestSessionSchema);