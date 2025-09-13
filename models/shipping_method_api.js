const mongoose = require('mongoose');

const shippingMethod = new mongoose.Schema({
    shipipng_code: {type:String, required: true},
    shipping_name: {type:String, required: true},
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


module.exports = mongoose.model('ShippignMethod', shippingMethod);