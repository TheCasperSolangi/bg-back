const mongoose = require('mongoose');

const guestLogin = new mongoose.Schema({
    username: {type:String, required: true},
    cart_code: {type:String, required: true},
    user_type: {type:String, required: true},
    device_id: {type:String },
    brand: {type:String },
    model: {type:String },

}, { timestamps: true });

module.exports = mongoose.model('Guests', guestLogin);