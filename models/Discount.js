const mongoose = require('mongoose');

const Discount = new mongoose.Schema({
    
    discount_type: {type:String, required: true, enum: ['product', 'campaign']},
    product_id: {type:String}, // product id to be entered in case the type is product
    
    discount_method: {type:String, required: true, enum: ['fixed', 'percentage']},
    value: {type:Number, requried: true},
    start_date: {type:String, required: true}, // the date the campaign is started
    end_date: {type:String, }, // leave blank if you want to use custom to close the campaign
    status: {type:String}, // Active or Inactive
    is_capped: {type:Number, required: true}, // 1 for true and 0 for false 
    capped_amount: {type:Number, required: true}
}, { timestamps: true });


module.exports = mongoose.model('Discount', Discount);  