const mongoose = require('mongoose');
const vendorScopePlugin = require('../plugin/vendorScopePlugin')
const shippingMethod = new mongoose.Schema({
    shipipng_code: {type:String, required: true},
    shipping_name: {type:String, required: true},
    vendor_code: { type: String,  index: true },
    shipping_types: [
        {
            name: {type:String}, // Express Delivery Normal Delivery'
            minimum_days: {type:Number},
            maximum_days: {type:Number},
            business_days_included: {type:Boolean},
            same_day_delivery: {type:Boolean},
            price: {type:Number}
        }
    ],

}, { timestamps: true });
shippingMethod.plugin(vendorScopePlugin);
module.exports = mongoose.model('ShippignMethod', shippingMethod);