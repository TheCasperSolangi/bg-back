const mongoose = require('mongoose');

const appSettingsSchema = new mongoose.Schema({
    appName: {type:String},
    appLogo: {type:String},
    enviroment: {type:String, enum: ['development', 'production']},
    primaryColor: {type:String}, // should be in hex values 
    secondaryColor: {type:String},
    appVersion: {type:String},
    privacy_policy: [
        {
            paragraph_heading: {type:String},
            paragraph_text: {type:String}
        }
    ],
    facebook: {type:String},
    instagram: {type:String},
    linkedin: {type:String},
    twitter: {type:String},
    pinterest: {type:String},
    phone: {type:String}, // use +CountryCode
    address: {type:String},
});

module.exports = mongoose.model('AppSettings', appSettingsSchema);