const mongoose = require('mongoose');
const vendorScopePlugin = require('../plugin/vendorScopePlugin')
const VoucherSchema = new mongoose.Schema({
     voucher_code: { type: String, required: true, unique: true, trim: true }, // e.g., PROMO50
    voucher_type: {type:String, required: true, enum: ['promotion_voucher', 'single-user-voucher', 'limited-voucher']},
    // if promotion voucher
    start_date: {type:String},

    end_date: {type:String},
    vendor_code: { type: String, index: true },
    // limited voucher
    max_attempts: {type:Number},
    pricing_type: {type:String, required: true, enum: ['fixed', 'discounted']},
    // if the voucher is capped at maximum pricing incase the voucher is fixed // is capped should be false
    is_capped: {type: String},
    capped_amount: {type:Number},
    voucher_value: {type:Number, required: true}
}, { timestamps: true });
VoucherSchema.plugin(vendorScopePlugin)
module.exports = mongoose.model('Vouchers', VoucherSchema);