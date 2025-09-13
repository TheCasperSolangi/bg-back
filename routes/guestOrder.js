const express = require('express');
const router = express.Router();

// Guest order controller methods
const {
  createGuestOrder,
  getGuestOrderByCode,
  updateGuestOrderStatus,
  deleteGuestOrder,
  getGuestOrders,
  getGuestOrdersByEmail,
  markGuestOrderPaid,
  trackGuestOrderStatus,
  updateGuestOrderLalamove,
  getGuestLalamoveTracking,
  sendGuestOrderNotification
} = require('../controllers/guestOrderController');

// Guest PayPal controller methods
const guestPaypalController = require('../controllers/guestPaypalController');

// Guest Stripe controller methods
const guestStripeController = require('../controllers/guestStripeController');

const { protect, authorizeRoles } = require('../middleware/authMiddleware');

// ===== GUEST PAYPAL ROUTES =====
// Create PayPal payment for guest order
router.post('/paypal/create-payment', guestPaypalController.createGuestPayment);

// Execute PayPal payment for guest order
router.post('/paypal/execute-payment', guestPaypalController.executeGuestPayment);

// Cancel PayPal payment for guest order
router.post('/paypal/cancel-payment', guestPaypalController.cancelGuestPayment);

// Get PayPal payment status for guest order
router.get('/paypal/payment/:payment_id', guestPaypalController.getGuestPaymentStatus);

// Refund PayPal payment for guest order (Admin only)
router.post('/paypal/refund', protect, authorizeRoles('admin'), guestPaypalController.refundGuestPayment);

// ===== GUEST STRIPE ROUTES =====
// Create Stripe payment intent for guest order
router.post('/stripe/create-payment-intent', guestStripeController.createGuestPaymentIntent);

// Confirm Stripe payment and create guest order
router.post('/stripe/confirm-payment', guestStripeController.confirmGuestPayment);

// Stripe webhooks for guest orders
router.post('/stripe/webhook', guestStripeController.handleGuestWebhook);

// ===== GUEST ORDER ROUTES =====
// Place new guest order (non-PayPal, non-Stripe)
router.post('/', createGuestOrder);

// Get guest order by order_code (requires session_id as query parameter)
router.get('/:order_code', getGuestOrderByCode);

// Track guest order status (public access)
router.get('/:order_code/track', trackGuestOrderStatus);

// Get guest orders by email (public but should have additional security)
router.get('/email/:email', getGuestOrdersByEmail);

// ===== ADMIN-ONLY ROUTES =====
// Update guest order status (Admin only)
router.put('/:order_code/status', protect, authorizeRoles('admin'), updateGuestOrderStatus);

// Delete guest order (Admin only)
router.delete('/:order_code', protect, authorizeRoles('admin'), deleteGuestOrder);

// Mark guest order as paid (Admin only)
router.put('/:order_code/mark_paid', protect, authorizeRoles('admin'), markGuestOrderPaid);

// Get all guest orders (Admin only)
router.get('/', protect, authorizeRoles('admin'), getGuestOrders);

// Send manual notification for guest order (Admin only)
router.post('/:order_code/notify', protect, authorizeRoles('admin'), sendGuestOrderNotification);

// ===== LALAMOVE ROUTES =====
// Update guest order with Lalamove details (requires session_id in body)
router.patch('/:order_code/lalamove', updateGuestOrderLalamove);

// Get Lalamove tracking details for guest order (requires session_id as query parameter)
router.get('/:order_code/lalamove/tracking', getGuestLalamoveTracking);

module.exports = router;