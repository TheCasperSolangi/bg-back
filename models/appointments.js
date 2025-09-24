const mongoose = require('mongoose');
const vendorScopePlugin = require("../plugin/vendorScopePlugin");
const appointmentsSchema = new mongoose.Schema({
        appointment_code: {type:String, required: true}, 
        slot_code: {type:String, required: true},
        username: {type:String, required: true},
        status: {type:String, required: true, enum: ['SCHEDULED', 'CANCELLED']},
        // in case cancelled
        cancellation_reason: {type:String},
        // incase rescheduled
        vendor_code: { type: String, index: true },
        reschedule_slot_code: {type:String}
});
appointmentsSchema.plugin(vendorScopePlugin);
module.exports = mongoose.model('Appointments', appointmentsSchema);