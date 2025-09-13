const express = require('express');
const router = express.Router();
const {
  toggleFavorite,
  getUserFavorites,
  isFavorite,
  getMyFavorites
} = require('../controllers/favoriteController');
const {protect, authorizeRoles} = require('../middleware/authMiddleware');

// POST /api/favorites -> toggle favorite
router.post('/', toggleFavorite);

// GET /api/favorites/:username -> get all favorites for a user
router.get('/', protect, getMyFavorites);

// GET /api/favorites/:username/:product_code -> check if product is favorite
router.get('/:username/:product_code', isFavorite);

module.exports = router;