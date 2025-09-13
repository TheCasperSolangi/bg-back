const mongoose = require('mongoose');

const qnaSchema = new mongoose.Schema({
    product_code: { type: String, required: true },
    question_code: { type: String, required: true },
    question: { type: String, required: true },
    answer: { type: String, default: "" }, // answer is optional initially
    status: { type: String, default: 'visible', enum: ['visible', 'hidden'] }
}, { timestamps: true });

module.exports = mongoose.model('QnA', qnaSchema);