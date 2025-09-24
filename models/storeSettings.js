const mongoose = require('mongoose');
const vendorScopePlugin = require("../plugin/vendorScopePlugin");
const storeSettingsSchema = new mongoose.Schema({
    vendor_code: { type: String,  lowercase: true, trim: true, index: true },
    vendor_subdomain: { type: String,  lowercase: true, trim: true, unique: true }, // 👈 add this
    appName: { type: String },
    appLogo: { type: String },
    enviroment: { type: String, enum: ['development', 'production'] },
    primaryColor: { type: String }, // hex values
    secondaryColor: { type: String },
    footer_text: {type:String},
    footer_company_text: {type:String},
    company_text: {type:String},
    appVersion: { type: String },
    privacy_policy: [
        {
            paragraph_heading: { type: String },
            paragraph_text: { type: String }
        }
    ],
    about_us: [
        {
            block_type: {type:String, enum: ['Text', 'Media']},
            title: {type:String},
            value: {type:String}
        }
    ],
     shipping_policy: [
        {
            block_type: {type:String, enum: ['Text', 'Media']},
            title: {type:String},
            value: {type:String}
        }
    ],
     terms_of_service: [
        {
            paragraph_heading: { type: String },
            paragraph_text: { type: String }
        }
    ],
    // Social_Logins
    facebook: { type: String },
    whatsapp: {type:String},
    instagram: { type: String },
    linkedin: { type: String },
    twitter: { type: String },
    pinterest: { type: String },
    phone: { type: String }, // +CountryCode
    address: { type: String },
    youtube: {type:String},
    tiktok: {type:String},
    minimum_points: {type:Number}, // minimum rewards points that equal to one dollar or currency
cordinates: [
  {
    lat: { type: String },
    lon: { type: String },
    
  }
]

}, { timestamps: true });
storeSettingsSchema.plugin(vendorScopePlugin);
module.exports = mongoose.model('StoreSettings', storeSettingsSchema);