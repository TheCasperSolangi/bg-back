const mongoose = require('mongoose');
const vendorScopePlugin = require('../plugin/vendorScopePlugin')
const notificationsSchema = new mongoose.Schema({
    notification_code: {type:String, required: true},
    notification_type: {type:String, required: true, enum: ['GENERAL', 'SPECIFIC_USER']},
    vendor_code: { type: String,  index: true },
    // incase specific user 
    username: {type:String, required: true},
    notification_title: {type:String, required: true},
    notification_text: {type:String, required: true},
    notification_attachments: [String],
    notification_href: {type:String},
    is_read: {type:Boolean, default: false},
    status: {type:String, required: true, enum: ['DELIVERED', 'SENT']}
});
notificationsSchema.plugin(vendorScopePlugin);
module.exports = mongoose.model('Notifications', notificationsSchema);