const mongoose = require('mongoose');

const AuthSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  email:    { type: String, unique: true, required: true },
  password: { type: String, required: true },
  user_type:{ type: String, enum: ['admin', 'user', 'guest'], default: 'user' }
});

module.exports = mongoose.model('Auth', AuthSchema);