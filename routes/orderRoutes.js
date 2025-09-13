const express = require('express');
const router = express.Router();

// Regular order controller methods
const {
  createOrder,
  getOrderByCode,
  updateOrderStatus,
  deleteOrder,
  getOrders,
  markOrderPaid,
  generateInvoice,
  getOrdersByUser,
  trackOrderStatus,
  updateOrderLalamove,
  getLalamoveTracking
} = require('../controllers/orderController');

// PayPal controller methods
const paypalController = require('../controllers/paypalController');

const { protect, authorizeRoles } = require('../middleware/authMiddleware');

// PayPal routes
router.post('/paypal/create-payment', protect, paypalController.createPayment);
router.post('/paypal/execute-payment', protect, paypalController.executePayment);
router.post('/paypal/cancel-payment', protect, paypalController.cancelPayment);
router.get('/paypal/payment/:payment_id', protect, paypalController.getPaymentStatus);
router.post('/paypal/refund', protect, authorizeRoles('admin'), paypalController.refundPayment);

// Regular order routes
// Place new order from cart (non-PayPal)
router.post('/', createOrder);

// Get order by order_code
router.get('/:order_code', getOrderByCode);

// Update order status
router.put('/:order_code/status', updateOrderStatus);

// Get orders by user
router.get("/user/:username", getOrdersByUser);

// Delete order
router.delete('/:order_code', deleteOrder);

// Mark order as paid
router.put('/:order_code/mark_paid', markOrderPaid);

// Generate invoice
router.get('/:order_code/generate_invoice', protect, authorizeRoles('admin', 'user'), generateInvoice);

// Get all orders (admin)
router.get('/', protect, authorizeRoles('admin'), getOrders);

// Track order status (public access)
router.get('/:order_code/track', trackOrderStatus);
// Lalamove related routes
router.patch('/:order_code/lalamove',  updateOrderLalamove);
router.get('/:order_code/lalamove/tracking',  getLalamoveTracking);

module.exports = router;