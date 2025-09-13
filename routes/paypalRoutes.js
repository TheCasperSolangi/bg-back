// routes/paypalRoutes.js
const express = require('express');
const router = express.Router();
const {
  createPayment,
  executePayment,
  cancelPayment,
  getPaymentStatus,
  refundPayment
} = require('../controllers/paypalController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');


// @route   POST /api/paypal/create-payment
// @desc    Create PayPal payment
// @access  Private
router.post('/create-payment', protect, createPayment);

// @route   POST /api/paypal/execute-payment
// @desc    Execute PayPal payment
// @access  Private
router.post('/execute-payment', protect, executePayment);

// @route   POST /api/paypal/cancel-payment
// @desc    Cancel PayPal payment
// @access  Private
router.post('/cancel-payment', protect, cancelPayment);

// @route   GET /api/paypal/payment/:paymentId
// @desc    Get payment status
// @access  Private
router.get('/payment/:paymentId', protect, getPaymentStatus);

// @route   POST /api/paypal/refund
// @desc    Refund PayPal payment
// @access  Private/Admin
router.post('/refund', protect, authorizeRoles('admin'), refundPayment);

module.exports = router;