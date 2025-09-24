const mongoose = require('mongoose');
const vendorScopePlugin = require('../plugin/vendorScopePlugin');
const BannerSlidesSchema = new mongoose.Schema({
  banner_title: { type: String, required: true },
  vendor_code: { type: String, index: true },
  banner_name: { type: String, required: true },
  banner_image: { type: String, required: true },
  banner_type:{type:String, required: true, enum: ['HERO', 'MOBILE', 'Promotional']},
  cta:{type:String}
});
BannerSlidesSchema.plugin(vendorScopePlugin);

module.exports = mongoose.model('Banners', BannerSlidesSchema);