const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');

router.post('/', reviewController.createReview);
router.get('/', reviewController.getAllReviews);        // Get all reviews
router.delete('/:id', reviewController.deleteReview);   // Delete review by ID
// New routes
router.get('/user/:username', reviewController.getReviewsByUser);
router.get('/product/:product_code', reviewController.getReviewsByProduct);

module.exports = router;
