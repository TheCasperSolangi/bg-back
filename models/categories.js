const mongoose = require('mongoose');

const CategoriesSchema = new mongoose.Schema({
  category_code: { type: String, required: true, unique: true, trim: true },
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


module.exports = mongoose.model('Categories', CategoriesSchema);