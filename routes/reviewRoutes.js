const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');

router.post('/', reviewController.createReview);

// New routes
router.get('/user/:username', reviewController.getReviewsByUser);
router.get('/product/:product_code', reviewController.getReviewsByProduct);

module.exports = router;
