const mongoose = require('mongoose');

const ReviewSchema = new mongoose.Schema({
  full_name: { type: String, required: true },          // user's full name
  profile_picture: { type: String },                    // user's profile picture URL
  product_code: { type: String, required: true },
  review: { 
    type: Number, 
    required: true,
    min: [1, 'Review must be at least 1'],
    max: [5, 'Review cannot exceed 5']
  },
  review_text: { type: String, required: true },
  review_attachment: [String]
}, { timestamps: true });

// Ensure a user can only review a product once
ReviewSchema.index({ username: 1, product_code: 1 }, { unique: true });

module.exports = mongoose.model('Review', ReviewSchema);