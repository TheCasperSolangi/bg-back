const mongoose = require('mongoose');

const taxationSchema = new mongoose.Schema({
    tax_code: { type: String, required: true, unique: true, trim: true },
    tax_name: { type: String, required: true },
    tax_type: { type: String, required: true, enum: ['fixed_rate', 'fixed_percent'] },
    value: {type:Number}
}, { timestamps: true });

module.exports = mongoose.model('Taxes', taxationSchema);