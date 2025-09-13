const mongoose = require('mongoose');

const ledger_schema = new mongoose.Schema({
        full_name: {type:String, required: true},
        mobile_number: {type:String, required: true},
        amount_paid: {type:Number, required: true},
        amount_remaining: {type:Number},
        paid_with: {type:String, required: true, enum: ['CASH', 'DIGITAL']},
        transaction_id: {type:String}
});     

module.exports = mongoose.model('LedgerTransactions', ledger_schema);