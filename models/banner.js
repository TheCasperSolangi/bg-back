const mongoose = require('mongoose');

const BannerSlidesSchema = new mongoose.Schema({
  banner_title: { type: String, required: true },
  banner_name: { type: String, required: true },
  banner_image: { type: String, required: true },
  banner_type:{type:String, required: true, enum: ['HERO', 'MOBILE', 'Promotional']},
  cta:{type:String}
});

module.exports = mongoose.model('Banners', BannerSlidesSchema);