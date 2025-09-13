const express = require('express');
const router = express.Router();
const {
  getPromotions,
  getPromotionById,
  createPromotion,
  updatePromotion,
  deletePromotion
} = require('../controllers/promotionController');

// Routes

module.exports = router;