const Favorite = require('../models/favorites');
const Product = require('../models/product');
const asyncHandler = require('../utils/asyncHandler');


// Helper function: get all favorite products of a user
const fetchFavoriteProducts = async (username) => {
  const favorites = await Favorite.find({ username, is_favorite: true });
  const productCodes = favorites.map(fav => fav.product_code);
  return await Product.find({ product_code: { $in: productCodes } });
};

// @desc    Toggle favorite (add/remove)
// @route   POST /api/favorites
// @access  Private/User
exports.toggleFavorite = asyncHandler(async (req, res) => {
  const { username, product_code } = req.body;

  let favorite = await Favorite.findOne({ username, product_code });

  if (favorite) {
    // Toggle existing
    favorite.is_favorite = !favorite.is_favorite;
    await favorite.save();
  } else {
    favorite = await Favorite.create({ username, product_code, is_favorite: true });
  }

  res.json({ success: true, data: favorite });
});


// @desc    Get all favorites for logged-in user
// @route   GET /api/favorites/me
// @access  Private/User
exports.getMyFavorites = asyncHandler(async (req, res) => {
  const username = req.user.username;
  const favoriteProducts = await fetchFavoriteProducts(username);

  res.json({ 
    success: true, 
    count: favoriteProducts.length, 
    data: favoriteProducts 
  });
});


// @desc    Check if product is favorite
// @route   GET /api/favorites/:username/:product_code
// @access  Private/User
exports.isFavorite = asyncHandler(async (req, res) => {
  const { username, product_code } = req.params;

  const favorite = await Favorite.findOne({ username, product_code, is_favorite: true });

  res.json({ success: true, is_favorite: !!favorite });
});