const GuestOrder = require('../models/guestOrder');
const GuestCart = require('../models/guestCart'); // Assuming you have a guest cart model
const asyncHandler = require('../utils/asyncHandler');
const { customAlphabet } = require('nanoid');
const Notifications = require('../models/notifications');

// @desc Create guest order
// @route POST /api/guest-orders
// @access Public
exports.createGuestOrder = asyncHandler(async (req, res) => {
  const {
    order_code,
    guest_cart_code, // Different from regular cart_code
    payment_method,
    billing_address,
    shipping_address,
    special_instructions,
    delivery_type,
    schedule,
    lalamove_order_id,
    lalamove_share_url,
    customer, // { email, full_name, phone }
    session_id
  } = req.body;

  // Validate required fields
  if (!order_code || !guest_cart_code || !payment_method || !billing_address || !shipping_address || !special_instructions || !customer || !session_id) {
    return res.status(400).json({ success: false, message: 'All required fields must be provided' });
  }

  // Validate customer info
  if (!customer.email || !customer.full_name || !customer.phone) {
    return res.status(400).json({ success: false, message: 'Customer email, full name, and phone are required' });
  }

  // Check if order_code already exists
  const existingOrder = await GuestOrder.findOne({ order_code });
  if (existingOrder) {
    return res.status(400).json({ success: false, message: 'Order code already exists' });
  }

  // Fetch guest cart
  const guestCart = await GuestCart.findOne({ 
    cart_code: guest_cart_code,
    session_id: session_id 
  });
  
  if (!guestCart) {
    return res.status(404).json({ success: false, message: 'Guest cart not found' });
  }

  if (!guestCart.products || guestCart.products.length === 0) {
    return res.status(400).json({ success: false, message: 'Cart is empty' });
  }

  // Prepare items array from cart products using discounted prices
  const items = guestCart.products.map(p => ({
    product_id: p.product_id,
    quantity: p.quantity,
    original_price: p.price || 0,
    price: p.finalPrice || p.price || 0,
    discount_amount: p.discountAmount || 0,
    discount_applied: p.discountApplied || false,
    product_image: p.product_image || null,
    product_name: p.product_name || 'Product'
  }));

  // Calculate total using discounted prices
  const total = items.reduce((acc, item) => {
    const itemPrice = parseFloat(item.price) || 0;
    const quantity = parseInt(item.quantity) || 0;
    return acc + (itemPrice * quantity);
  }, 0);

  // Add any additional subtotal adjustments from cart
  const subtotalAdjustments = (guestCart.subtotal || []).reduce((acc, item) => {
    const value = parseFloat(item.value) || 0;
    return acc + value;
  }, 0);

  const finalTotal = Math.max(0, total + subtotalAdjustments);

  // Redirect Stripe payments to Stripe endpoint
  if (payment_method === 'CARD') {
    return res.status(400).json({
      success: false,
      message: 'Use Stripe endpoint to create card payments',
      redirect_to: '/api/guest-orders/stripe/create-payment-intent'
    });
  }

  // Redirect PayPal payments to PayPal endpoint
  if (payment_method === 'PAYPAL') {
    return res.status(400).json({
      success: false,
      message: 'Use PayPal endpoint to create PayPal orders',
      redirect_to: '/api/guest-orders/paypal/create-payment'
    });
  }

  // Create guest order
  const guestOrder = await GuestOrder.create({
    order_code,
    customer: {
      email: customer.email,
      full_name: customer.full_name,
      phone: customer.phone
    },
    session_id,
    items,
    total: parseFloat(finalTotal.toFixed(2)),
    payment_method,
    billing_address,
    shipping_address,
    status: 'pending',
    special_instructions,
    delivery_type: delivery_type,
    lalamove_order_id: lalamove_order_id,
    lalamove_share_url: lalamove_share_url,
    schedule_date: schedule,
    discount_summary: guestCart.discountInfo || null
  });

  // Delete guest cart after order is placed
  await GuestCart.findOneAndDelete({ 
    cart_code: guest_cart_code, 
    session_id: session_id 
  });

  // Create new guest cart
  const nanoid = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 10);
  const newGuestCartCode = nanoid();
  
  const newGuestCart = await GuestCart.create({
    cart_code: newGuestCartCode,
    session_id: session_id,
    products: [],
    subtotal: [],
    total: 0,
    discountInfo: {
      totalOriginalAmount: 0,
      totalFinalAmount: 0,
      totalDiscountAmount: 0,
      hasDiscounts: false,
      discountsApplied: []
    }
  });

  res.status(201).json({ 
    success: true, 
    data: guestOrder, 
    new_guest_cart_code: newGuestCart.cart_code 
  });
});

// @desc Get guest order by order_code
// @route GET /api/guest-orders/:order_code
// @access Public (with session verification)
exports.getGuestOrderByCode = asyncHandler(async (req, res) => {
  const { order_code } = req.params;
  const { session_id } = req.query; // Pass session_id as query parameter

  if (!session_id) {
    return res.status(400).json({ success: false, message: 'Session ID is required' });
  }

  const guestOrder = await GuestOrder.findOne({ 
    order_code, 
    session_id 
  }).populate('items.product_id');
  
  if (!guestOrder) {
    return res.status(404).json({ success: false, message: 'Guest order not found' });
  }

  res.json({ success: true, data: guestOrder });
});

// @desc Update guest order status (Admin only)
// @route PUT /api/guest-orders/:order_code/status
// @access Private/Admin
exports.updateGuestOrderStatus = asyncHandler(async (req, res) => {
  const { order_code } = req.params;
  const { status } = req.body;

  // Get the current order to check old status
  const currentOrder = await GuestOrder.findOne({ order_code });
  if (!currentOrder) {
    return res.status(404).json({ success: false, message: 'Guest order not found' });
  }

  // Update the order status
  const guestOrder = await GuestOrder.findOneAndUpdate(
    { order_code }, 
    { status }, 
    { new: true }
  );

  // Note: Guest orders don't have user notifications since there's no user account
  // You could implement email notifications here instead

  res.json({ success: true, data: guestOrder });
});

// @desc Delete guest order (Admin only)
// @route DELETE /api/guest-orders/:order_code
// @access Private/Admin
exports.deleteGuestOrder = asyncHandler(async (req, res) => {
  const { order_code } = req.params;

  const guestOrder = await GuestOrder.findOneAndDelete({ order_code });
  if (!guestOrder) {
    return res.status(404).json({ success: false, message: 'Guest order not found' });
  }

  res.json({ success: true, message: 'Guest order deleted successfully' });
});

// @desc Get all guest orders (Admin only)
// @route GET /api/guest-orders
// @access Private/Admin
exports.getGuestOrders = asyncHandler(async (req, res) => {
  const { email, session_id } = req.query;
  let query = {};

  if (email) {
    query['customer.email'] = email;
  }
  if (session_id) {
    query.session_id = session_id;
  }

  const guestOrders = await GuestOrder.find(query)
    .populate('items.product_id')
    .sort({ createdAt: -1 });

  res.json({ success: true, count: guestOrders.length, data: guestOrders });
});

// @desc Get guest orders by email
// @route GET /api/guest-orders/email/:email
// @access Public (but should verify with additional security)
exports.getGuestOrdersByEmail = asyncHandler(async (req, res) => {
  const { email } = req.params;
  const { session_id } = req.query; // Optional additional security

  if (!email) {
    return res.status(400).json({ success: false, message: "Email is required" });
  }

  let query = { "customer.email": email };
  if (session_id) {
    query.session_id = session_id;
  }

  const guestOrders = await GuestOrder.find(query)
    .populate("items.product_id")
    .sort({ createdAt: -1 });

  if (!guestOrders || guestOrders.length === 0) {
    return res.status(404).json({ success: false, message: "No orders found for this email" });
  }

  res.json({ success: true, count: guestOrders.length, data: guestOrders });
});

// @desc Mark guest order as paid (Admin only)
// @route PUT /api/guest-orders/:order_code/mark_paid
// @access Private/Admin
exports.markGuestOrderPaid = asyncHandler(async (req, res) => {
  const { order_code } = req.params;

  const guestOrder = await GuestOrder.findOne({ order_code });

  if (!guestOrder) {
    return res.status(404).json({ success: false, message: 'Guest order not found' });
  }

  guestOrder.status = 'paid';
  await guestOrder.save();

  res.json({ success: true, message: 'Guest order marked as paid', data: guestOrder });
});

// @desc Track guest order status by order_code
// @route GET /api/guest-orders/:order_code/track
// @access Public
exports.trackGuestOrderStatus = asyncHandler(async (req, res) => {
  const { order_code } = req.params;

  const guestOrder = await GuestOrder.findOne({ order_code });
  if (!guestOrder) {
    return res.status(404).json({ success: false, message: 'Guest order not found' });
  }

  let statusMessage;
  switch (guestOrder.status.toLowerCase()) {
    case 'pending':
      statusMessage = 'Your order is currently being reviewed. We will process it shortly.';
      break;
    case 'processing':
      statusMessage = 'We are working on your order. It will be prepared for shipping soon.';
      break;
    case 'shipped':
      statusMessage = 'Your order has been shipped and is on its way to you!';
      break;
    case 'delivered':
      statusMessage = 'Your order has been delivered. Thank you for shopping with us!';
      break;
    case 'cancelled':
      statusMessage = 'Your order has been cancelled. Please contact support if you have any questions.';
      break;
    case 'paid':
      statusMessage = 'Your payment has been received and your order is being processed.';
      break;
    case 'refunded':
      statusMessage = 'Your order has been refunded. The amount should reflect in your account soon.';
      break;
    case 'on hold':
      statusMessage = 'Your order is currently on hold. Our team will review it shortly.';
      break;
    default:
      statusMessage = 'Your order status is: ' + guestOrder.status;
  }

  res.json({ 
    success: true, 
    data: {
      order_code: guestOrder.order_code,
      status: guestOrder.status,
      status_message: statusMessage,
      customer_email: guestOrder.customer.email,
      last_updated: guestOrder.updatedAt
    }
  });
});

// @desc Update guest order with Lalamove details
// @route PATCH /api/guest-orders/:order_code/lalamove
// @access Public (with session verification)
exports.updateGuestOrderLalamove = asyncHandler(async (req, res) => {
  const { order_code } = req.params;
  const { lalamove_order_id, lalamove_share_url, session_id } = req.body;

  if (!session_id) {
    return res.status(400).json({ success: false, message: 'Session ID is required' });
  }

  // Find the order and verify session
  const guestOrder = await GuestOrder.findOne({ 
    order_code, 
    session_id 
  });
  
  if (!guestOrder) {
    return res.status(404).json({
      success: false,
      message: 'Guest order not found'
    });
  }

  // Update order fields
  guestOrder.lalamove_order_id = lalamove_order_id;
  guestOrder.lalamove_share_url = lalamove_share_url;

  await guestOrder.save();

  res.json({
    success: true,
    message: 'Guest order updated with Lalamove details',
    data: {
      order_code: guestOrder.order_code,
      lalamove_order_id: guestOrder.lalamove_order_id,
      lalamove_share_url: guestOrder.lalamove_share_url
    }
  });
});

// @desc Get Lalamove tracking details for guest order
// @route GET /api/guest-orders/:order_code/lalamove/tracking
// @access Public (with session verification)
exports.getGuestLalamoveTracking = asyncHandler(async (req, res) => {
  const { order_code } = req.params;
  const { session_id } = req.query;

  if (!session_id) {
    return res.status(400).json({ success: false, message: 'Session ID is required' });
  }

  // Find the order and verify session
  const guestOrder = await GuestOrder.findOne({ 
    order_code, 
    session_id 
  });
  
  if (!guestOrder) {
    return res.status(404).json({ 
      success: false, 
      message: 'Guest order not found' 
    });
  }

  if (!guestOrder.lalamove_order_id) {
    return res.status(404).json({ 
      success: false, 
      message: 'No Lalamove delivery found for this order' 
    });
  }

  res.json({ 
    success: true, 
    data: {
      order_code: guestOrder.order_code,
      lalamove_order_id: guestOrder.lalamove_order_id,
      lalamove_share_url: guestOrder.lalamove_share_url,
      delivery_type: guestOrder.delivery_type,
      status: guestOrder.status,
      tracking_available: !!guestOrder.lalamove_share_url
    }
  });
});

// @desc Send email notification for guest order updates
// @route POST /api/guest-orders/:order_code/notify
// @access Private/Admin
exports.sendGuestOrderNotification = asyncHandler(async (req, res) => {
  const { order_code } = req.params;
  const { type, title, message } = req.body;

  const guestOrder = await GuestOrder.findOne({ order_code });
  if (!guestOrder) {
    return res.status(404).json({ success: false, message: 'Guest order not found' });
  }

  if (!type || !title || !message) {
    return res.status(400).json({ 
      success: false, 
      message: 'Type, title, and message are required' 
    });
  }

  try {
    // Since guest orders don't have user accounts, you would send email notifications
    // This is where you'd integrate with your email service (SendGrid, Mailgun, etc.)
    
    const emailData = {
      to: guestOrder.customer.email,
      subject: title,
      message: message,
      order_code: guestOrder.order_code,
      customer_name: guestOrder.customer.full_name
    };

    // Placeholder for email service integration
    // await emailService.sendOrderUpdate(emailData);

    res.json({
      success: true,
      message: 'Email notification sent to guest customer',
      email_sent_to: guestOrder.customer.email
    });
  } catch (error) {
    console.error('Failed to send guest order notification:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send notification',
      error: error.message 
    });
  }
});