const mongoose = require('mongoose');

const slotsSchema = new mongoose.Schema({
    slot_code: {type:String, required: true},
    slot_name: {type:String, required: true},
    runtime: {type:Number, required: true},
    max_bookings: {type:Number, required: true},
    current_bookings: {type:Number, required: true},
    start_time: {type:String, required: true}, // HH-MM-SS 24 hour format
    date: {type:String, required: true},
    end_time: {type:String, required: true},
});

module.exports = mongoose.model('Slots', slotsSchema);