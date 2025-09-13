const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    transaction_id: {type:String, required: true}, 
    transaction_type: {type:String, required: true, enum: ['DEBIT', 'CREDIT']},
    transaction_title: {type:String, required: true},
    transaction_reference: {type:String, required: true}, /// Can be order Id, refund id, etc etc
    username: {type:String}, // not required incase it's a general cashback or settlement to all 
    amount: {type:Number, required: true},
    status: {type:String, required: true, enum: ['PENDING', 'CANCELLED', 'COMPLETE']},

}, { timestamps: true });

module.exports = mongoose.model('Transactions', transactionSchema);