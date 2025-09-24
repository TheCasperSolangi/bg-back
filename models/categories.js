const mongoose = require('mongoose');
const vendorScopePlugin = require('../plugin/vendorScopePlugin');
const CategoriesSchema = new mongoose.Schema({
  category_code: { type: String, required: true, unique: true, trim: true },
  vendor_code: { type: String, index: true },
  category_name: { type: String, required: true },
  description: {type:String},
  short_description: {type:String},
  image: {type:String},
  icon: {type:String},
  // SEO 
  metaTitle: {type:String},
  metaDesc: {type:String},
  keywords: {type:String},
  
  
}, { timestamps: true });

CategoriesSchema.plugin(vendorScopePlugin);
module.exports = mongoose.model('Categories', CategoriesSchema);