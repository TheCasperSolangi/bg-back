const mongoose = require('mongoose');
const vendorScopePlugin = require('../plugin/vendorScopePlugin')
const qnaSchema = new mongoose.Schema({
    product_code: { type: String, required: true },
    question_code: { type: String, required: true },
    question: { type: String, required: true },
    vendor_code: { type: String,  index: true },
    answer: { type: String, default: "" }, // answer is optional initially
    status: { type: String, default: 'visible', enum: ['visible', 'hidden'] }
}, { timestamps: true });
qnaSchema.plugin(vendorScopePlugin);
module.exports = mongoose.model('QnA', qnaSchema);