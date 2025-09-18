const Review = require('../models/reviewSchema');
const Order = require('../models/order');
const Product = require('../models/product');
const asyncHandler = require('../utils/asyncHandler');

// @desc    Create a review
// @route   POST /api/reviews
exports.createReview = asyncHandler(async (req, res) => {
  const { username, product_code, review, review_text, review_attachment } = req.body;

  if (!username || !product_code || !review || !review_text) {
    return res.status(400).json({ success: false, message: 'Username, product_code, review, and review_text are required' });
  }

  // Check if the product exists
  const product = await Product.findOne({ product_code });
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  // Verify user has at least one order containing this product
  const order = await Order.findOne({
    'user.username': username,
    'items.product_id': product._id
  });

  if (!order) {
    return res.status(400).json({ success: false, message: 'User must have purchased this product before reviewing' });
  }

  // Extract full_name and profile_picture from the order
  const { full_name, profile_picture } = order.user;

  // Check if the user already reviewed this product
  const existing = await Review.findOne({ full_name, product_code });
  if (existing) {
    return res.status(400).json({ success: false, message: 'User has already reviewed this product' });
  }

  // Create new review
  const newReview = await Review.create({
    full_name,
    profile_picture: profile_picture || '',
    product_code,
    review,
    review_text,
    review_attachment: review_attachment || []
  });

  // 🔹 Recalculate average rating for the product
  const agg = await Review.aggregate([
    { $match: { product_code } },
    { $group: { _id: "$product_code", avgRating: { $avg: "$review" } } }
  ]);

  if (agg.length > 0) {
    await Product.updateOne(
      { product_code },
      { $set: { ratings: agg[0].avgRating.toFixed(1) } } // keep one decimal place
    );
  }

  res.status(201).json({ 
    message: "Review posted successfully, Please note review once posted cannot be deleted/updated", 
    success: true, 
    data: newReview 
  });
});
// @desc    Get all reviews by a specific user
// @route   GET /api/reviews/user/:username
exports.getReviewsByUser = asyncHandler(async (req, res) => {
  const { username } = req.params;

  if (!username) {
    return res.status(400).json({ success: false, message: 'Username is required' });
  }

  // Fetch all orders of this user to map their full_name
  const orders = await Order.find({ 'user.username': username });
  if (!orders.length) {
    return res.status(404).json({ success: false, message: 'No Reviews found for this user' });
  }

  const full_names = [...new Set(orders.map(order => order.user.full_name))];

  const reviews = await Review.find({ full_name: { $in: full_names } });

  res.status(200).json({ success: true, data: reviews });
});

// @desc    Get all reviews for a specific product
// @route   GET /api/reviews/product/:product_code
exports.getReviewsByProduct = asyncHandler(async (req, res) => {
  const { product_code } = req.params;

  if (!product_code) {
    return res.status(400).json({ success: false, message: 'Product code is required' });
  }

  const reviews = await Review.find({ product_code });

  res.status(200).json({ success: true, data: reviews });
});

// @desc    Get all reviews
// @route   GET /api/reviews
exports.getAllReviews = asyncHandler(async (req, res) => {
  const reviews = await Review.find().sort({ createdAt: -1 }); // latest first
  res.status(200).json({ success: true, data: reviews });
});

// @desc    Delete a review by ID
// @route   DELETE /api/reviews/:id
exports.deleteReview = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const review = await Review.findById(id);
  if (!review) {
    return res.status(404).json({ success: false, message: 'Review not found' });
  }

  await Review.findByIdAndDelete(id);

  // 🔹 Recalculate average rating for the product
  const agg = await Review.aggregate([
    { $match: { product_code: review.product_code } },
    { $group: { _id: "$product_code", avgRating: { $avg: "$review" } } }
  ]);

  if (agg.length > 0) {
    await Product.updateOne(
      { product_code: review.product_code },
      { $set: { ratings: agg[0].avgRating.toFixed(1) } }
    );
  } else {
    // If no reviews left, reset rating to 0
    await Product.updateOne(
      { product_code: review.product_code },
      { $set: { ratings: 0 } }
    );
  }

  res.status(200).json({ success: true, message: 'Review deleted successfully' });
});