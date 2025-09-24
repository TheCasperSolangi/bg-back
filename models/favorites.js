const mongoose = require('mongoose');
const vendorScopePlugin = require('../plugin/vendorScopePlugin');
const favoriteSchema = new mongoose.Schema({
    username: {type:String, required: true},
    product_code: {type:String, required: true},
    vendor_code: { type: String,  index: true },
    is_favorite: {type:Boolean, required: true}

}, { timestamps: true });
favoriteSchema.plugin(vendorScopePlugin);
module.exports = mongoose.model('FavoriteProducts', favoriteSchema);