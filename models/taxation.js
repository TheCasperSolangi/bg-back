const mongoose = require('mongoose');
const vendorScopePlugin = require('../plugin/vendorScopePlugin');
const taxationSchema = new mongoose.Schema({
    tax_code: { type: String, required: true, unique: true, trim: true },
    tax_name: { type: String, required: true },
    vendor_code: { type: String, index: true },
    tax_type: { type: String, required: true, enum: ['fixed_rate', 'fixed_percent'] },
    value: {type:Number}
}, { timestamps: true });
taxationSchema.plugin(vendorScopePlugin)
module.exports = mongoose.model('Taxes', taxationSchema);