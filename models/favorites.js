const mongoose = require('mongoose');

const favoriteSchema = new mongoose.Schema({
    username: {type:String, required: true},
    product_code: {type:String, required: true},
    is_favorite: {type:Boolean, required: true}

}, { timestamps: true });

module.exports = mongoose.model('FavoriteProducts', favoriteSchema);