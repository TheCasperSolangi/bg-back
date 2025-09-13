// routes/stripe.js
const express = require('express');
const router = express.Router();
const {
  createPaymentIntent,
  confirmPayment,
  handleWebhook,
  getPaymentMethods,
  savePaymentMethod
} = require('../controllers/stripeController');
const { protect } = require('../middleware/authMiddleware'); // Assuming you have auth middleware

// @route   POST /api/stripe/create-payment-intent
// @desc    Create Stripe payment intent
// @access  Private
router.post('/create-payment-intent', protect, createPaymentIntent);

// @route   POST /api/stripe/confirm-payment
// @desc    Confirm Stripe payment and create order
// @access  Private
router.post('/confirm-payment', protect, confirmPayment);

// @route   POST /api/stripe/webhook
// @desc    Handle Stripe webhooks
// @access  Public (but verified with Stripe signature)
router.post('/webhook', express.raw({ type: 'application/json' }), handleWebhook);

// @route   GET /api/stripe/payment-methods
// @desc    Get saved payment methods for user
// @access  Private
router.get('/payment-methods', protect, getPaymentMethods);

// @route   POST /api/stripe/save-payment-method
// @desc    Save payment method for future use
// @access  Private
router.post('/save-payment-method', protect, savePaymentMethod);

module.exports = router;