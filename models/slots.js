const mongoose = require('mongoose');
const vendorScopePlugin = require('../plugin/vendorScopePlugin')
const slotsSchema = new mongoose.Schema({
    slot_code: {type:String, required: true},
    vendor_code: { type: String,  index: true },
    slot_name: {type:String, required: true},
    runtime: {type:Number, required: true},
    max_bookings: {type:Number, required: true},
    current_bookings: {type:Number, required: true},
    start_time: {type:String, required: true}, // HH-MM-SS 24 hour format
    date: {type:String, required: true},
    end_time: {type:String, required: true},
});
slotsSchema.plugin(vendorScopePlugin)
module.exports = mongoose.model('Slots', slotsSchema);