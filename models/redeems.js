const mongoose = require('mongoose');
const vendorScopePlugin = require('../plugin/vendorScopePlugin')
const ReedemSchema = new mongoose.Schema({
    reedemable_code: { type: String, required: true, unique: true }, // each code unique
    vendor_code: { type: String, index: true },
    required_points: { type: Number, required: true },
    value: { type: Number }
}, { timestamps: true });
ReedemSchema.plugin(vendorScopePlugin);
module.exports = mongoose.model('Reedem', ReedemSchema);