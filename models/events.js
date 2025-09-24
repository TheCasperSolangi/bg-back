const mongoose = require('mongoose');
const vendorScopePlugin = require('../plugin/vendorScopePlugin');
const eventSchema = new mongoose.Schema({
    event_type: { type: String, required: true, enum: ['view', 'click'] },
    event_on: { type: String, required: true, enum: ['store', 'product', 'category'] },
    vendor_code: { type: String,  index: true },
    // In case product
    product_code: { type: String },
    // In case categories
    category_code: { type: String },

    // Meta data
    event_country: { type: String, required: true },
    event_city: { type: String },
    event_ip: { type: String },

    // User info
   
    session_id: { type: String },

    // Device info
    device_type: { type: String, enum: ['desktop', 'mobile', 'tablet'] },
    os: { type: String },
    browser: { type: String },

    // Marketing
    referrer_url: { type: String },
    campaign_code: { type: String },

    // Flexible data
    extra_data: { type: mongoose.Schema.Types.Mixed }

}, { timestamps: true });
eventSchema.plugin(vendorScopePlugin)
module.exports = mongoose.model('Events', eventSchema);