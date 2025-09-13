const mongoose = require('mongoose');

const appointmentsSchema = new mongoose.Schema({
        appointment_code: {type:String, required: true}, 
        slot_code: {type:String, required: true},
        username: {type:String, required: true},
        status: {type:String, required: true, enum: ['SCHEDULED', 'CANCELLED']},
        // in case cancelled
        cancellation_reason: {type:String},
        // incase rescheduled
        reschedule_slot_code: {type:String}
});

module.exports = mongoose.model('Appointments', appointmentsSchema);