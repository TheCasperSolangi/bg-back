const mongoose = require('mongoose');

const ledger_schema = new mongoose.Schema({
        full_name: {type:String, required: true},
        mobile_number: {type:String, required: true},
        order_code: {type:String, required: true},
        amount_due: {type:Number, required: true},
        expected_due_date: {type:String, required: true},
        is_paid: {type:Boolean, required: true, default: false},
        paid_on: {type:String}
});     

module.exports = mongoose.model('LedgerBook', ledger_schema);