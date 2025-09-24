const mongoose = require('mongoose');
const vendorScopePlugin = require('../plugin/vendorScopePlugin');
const promotionBannersSchema = new mongoose.Schema({
    title: {type:String}, // e.g Summer sale
    subtitle: {type:String}, // Upto 30% off
    description: {type:String}, // Descriptions
    image_desktop: {type:String},
    vendor_code: { type: String, index: true },
    image_mobile: {type:String},
    video_url: {type:String},
    link_type: {type:String, enum: ["PRODUCT", "CATEOGRY", "COLLECTION", 'DISCOUNT', 'CUSTOM_URL']},
    link_target: {type:String}, // href
    start_date: {type:String},
    end_date: {type:String},
    is_active: {type:String},
 
});
promotionBannersSchema.plugin(vendorScopePlugin);
module.exports = mongoose.model('Promotions', promotionBannersSchema);