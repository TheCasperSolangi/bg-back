const Order = require('../models/order');
const Cart = require('../models/cart');
const asyncHandler = require('../utils/asyncHandler');
const pdf = require('html-pdf');
const fs = require('fs');
const User = require('../models/User');
const { customAlphabet } = require('nanoid');
const Notifications = require('../models/notifications');
const { notification } = require('paypal-rest-sdk');
const Product = require('../models/product')
// @access Private (user)
exports.createOrder = asyncHandler(async (req, res) => {
  const {
    order_code,
    cart_code,
    payment_method,
    billing_address,
    shipping_address,
    special_instructions, delivery_type, schedule,
    lalamove_order_id,
    lalamove_share_url
  } = req.body;

  if (!order_code || !cart_code || !payment_method || !billing_address || !shipping_address || !special_instructions) {
    return res.status(400).json({ success: false, message: 'All fields are required' });
  }

  // Check if order_code already exists
  const existingOrder = await Order.findOne({ order_code });
  if (existingOrder) {
    return res.status(400).json({ success: false, message: 'Order code already exists' });
  }

  // Fetch cart
  const cart = await Cart.findOne({ cart_code });
  if (!cart) {
    return res.status(404).json({ success: false, message: 'Cart not found' });
  }

  if (!cart.products || cart.products.length === 0) {
    return res.status(400).json({ success: false, message: 'Cart is empty' });
  }

  // Fetch user based on cart.username
  const user = await User.findOne({ username: cart.username });
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  // Prepare items array from cart products using discounted prices
  const items = cart.products.map(p => ({
    product_id: p.product_id,
    quantity: p.quantity,
    original_price: p.price || 0,
    price: p.finalPrice || p.price || 0,
    discount_amount: p.discountAmount || 0,
    discount_applied: p.discountApplied || false,
    product_image: p.product_image || null
  }));

  // Calculate total using discounted prices (finalPrice)
  const total = items.reduce((acc, item) => {
    const itemPrice = parseFloat(item.price) || 0;
    const quantity = parseInt(item.quantity) || 0;
    return acc + (itemPrice * quantity);
  }, 0);

  // Add any additional subtotal adjustments from cart
  const subtotalAdjustments = (cart.subtotal || []).reduce((acc, item) => {
    const value = parseFloat(item.value) || 0;
    return acc + value;
  }, 0);

  const finalTotal = Math.max(0, total + subtotalAdjustments);

  // If payment_method is WALLET_BALANCE, check and deduct from wallet
  if (payment_method === 'WALLET_BALANCE') {
    if (!user.wallet_balance || user.wallet_balance < finalTotal) {
      return res.status(400).json({ success: false, message: 'Insufficient wallet balance' });
    }

    user.wallet_balance -= finalTotal;
    await user.save();
  }

  // Redirect Stripe payments to Stripe endpoint
  if (payment_method === 'CARD') {
    return res.status(400).json({
      success: false,
      message: 'Use Stripe endpoint to create card payments',
      redirect_to: '/api/stripe/create-payment-intent'
    });
  }

  // Redirect PayPal payments to PayPal endpoint
  if (payment_method === 'PAYPAL') {
    return res.status(400).json({
      success: false,
      message: 'Use PayPal endpoint to create PayPal orders',
      redirect_to: '/api/paypal/create-payment'
    });
  }

  // Create order with embedded user details and discount information
  const order = await Order.create({
    order_code,
    user: {
      _id: user._id,
      username: user.username,
      email: user.email,
      full_name: user.full_name,
      profile_picture: user.profile_picture || null
    },
    items,
    total: parseFloat(finalTotal.toFixed(2)), // Round to 2 decimal places
    payment_method,
    billing_address,
    shipping_address,
    status: payment_method === 'WALLET_BALANCE' ? 'paid' : 'pending',
    special_instructions,
    delivery_type: delivery_type,
    lalamove_order_id: lalamove_order_id,
    lalamove_share_url: lalamove_share_url,
    schedule_date: schedule,
    // Add discount summary to order for reference
    discount_summary: cart.discountInfo || null,
    // Initialize payment_info for non-Stripe payments
    payment_info: {
      payment_status: payment_method === 'WALLET_BALANCE' ? 'completed' : 'pending'
    }
  });

  // Delete cart after order is placed
  await Cart.findOneAndDelete({ cart_code });
   const nanoid = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 10);
        const newCartCode = nanoid();
  
       const newCart = await Cart.create({
  cart_code: newCartCode,
  username: user.username,
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
        const notificationCode = `NOTIFY-${nanoid()}`
  const notifyUser =  await Notifications.create({
          notification_code: notificationCode,
          notification_type: "SPECIFIC_USER",
          username: user.username,
          notification_title: `Order Successfully Placed`,
          notification_text: `Dear Customer, your order ${order.order_code} has been successfully place and is currently being reviewed`,
          notification_attachments: [],
          notification_href: "",
          is_read: false,
          status: "SENT"

  })

   /** ------------------------------
   * Calculate reward points function
   * ------------------------------ */
  async function calculateRewardPoints(cartProducts) {
    let rewardTotal = 0;

    for (const cp of cartProducts) {
      const product = await Product.findById(cp.product_id).lean();
      if (product && product.reward_points) {
        rewardTotal += (product.reward_points * (cp.quantity || 1));
      }
    }
    return rewardTotal;
  }

  // Calculate reward points earned from this order
  const earnedRewardPoints = await calculateRewardPoints(cart.products);

  // Add to user reward_points balance
  user.reward_points = (user.reward_points || 0) + earnedRewardPoints;
  await user.save();


  

  res.status(201).json({ success: true, data: order, new_cart_code: newCart.cart_code, notifyUser, earnedRewardPoints });
});
// @desc Get order by order_code
// @route GET /api/orders/:order_code
// @access Private/User/Admin
exports.getOrderByCode = asyncHandler(async (req, res) => {
  const { order_code } = req.params;

  const order = await Order.findOne({ order_code }).populate('items.product_id');
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  res.json({ success: true, data: order });
});

// @desc Update order status
// @route PUT /api/orders/:order_code/status
// @access Private/Admin
exports.updateOrderStatus = asyncHandler(async (req, res) => {
  const { order_code } = req.params;
  const { status } = req.body;

  // Get the current order to check old status
  const currentOrder = await Order.findOne({ order_code });
  if (!currentOrder) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  const oldStatus = currentOrder.status;

   const nanoid = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 10);
  const notificationCode = `NOTIFY-${nanoid()}`
  const PaymentNotification = await Notifications.create({
        notification_code: notificationCode,
        notification_type: "SPECIFIC_USER",
        username: order.user.username,
        notification_title: "ORDER UPDATES",
        notification_text: `Your Order ${order.order_code} has been changed to ${req.body.status}`,
        notification_attachments: [],
        notification_href: "",
        is_read: false,
        status: "SENT"
  })


  // Update the order status
  const order = await Order.findOneAndUpdate({ order_code }, { status }, { new: true });

 

  res.json({ success: true, data: order, PaymentNotification });
});
// @desc Delete order by order_code
// @route DELETE /api/orders/:order_code
// @access Private/Admin
exports.deleteOrder = asyncHandler(async (req, res) => {
  const { order_code } = req.params;

  const order = await Order.findOneAndDelete({ order_code });
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

     const nanoid = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 10);
  const notificationCode = `NOTIFY-${nanoid()}`
  const PaymentNotification = await Notifications.create({
        notification_code: notificationCode,
        notification_type: "SPECIFIC_USER",
        username: order.user.username,
        notification_title: "ORDER DELETED",
        notification_text: `Your Order ${order.order_code} has been Deleted, if you do not do it please reach to us on customer support`,
        notification_attachments: [],
        notification_href: "",
        is_read: false,
        status: "SENT"
  })


  res.json({ success: true, message: 'Order deleted successfully', PaymentNotification });
});

// @desc Get all orders (optionally filter by username via query param)
// @route GET /api/orders
// @access Private/Admin
exports.getOrders = asyncHandler(async (req, res) => {
  const { username } = req.query;
  let query = {};

  if (username) {
    query['items.username'] = username; // If you want to filter by username, you'd need username stored in items or order
    // Alternatively, extend order schema or relate order to user another way.
  }

  const orders = await Order.find(query).populate('items.product_id').sort({ createdAt: -1 });

  res.json({ success: true, count: orders.length, data: orders });
});

// @desc Get all orders for a specific user
// @route GET /api/orders/user/:username
// @access Private/Admin
exports.getOrdersByUser = asyncHandler(async (req, res) => {
  const { username } = req.params;

  if (!username) {
    return res.status(400).json({ success: false, message: "Username is required" });
  }

  // Filter orders where the order.user.username matches
  const orders = await Order.find({ "user.username": username })
    .populate("items.product_id")
    .sort({ createdAt: -1 });

  if (!orders || orders.length === 0) {
    return res.status(404).json({ success: false, message: "No orders found for this user" });
  }

  res.json({ success: true, count: orders.length, data: orders });
});

// @desc Mark order as paid
// @route PUT /api/orders/:order_code/mark_paid
// @access Private/Admin
exports.markOrderPaid = asyncHandler(async (req, res) => {
  const { order_code } = req.params;

  const order = await Order.findOne({ order_code });

  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  const oldStatus = order.status;
  order.status = 'paid';
  await order.save();
 const nanoid = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 10);
  const notificationCode = `NOTIFY-${nanoid()}`
  const PaymentNotification = await Notifications.create({
        notification_code: notificationCode,
        notification_type: "SPECIFIC_USER",
        username: order.user.username,
        notification_title: "ORDER UPDATES",
        notification_text: `Payment against Order ${order.order_code} has been received, thank you for shopping with us`,
        notification_attachments: [],
        notification_href: "",
        is_read: false,
        status: "SENT"
  })

  res.json({ success: true, message: 'Order marked as paid', data: order, PaymentNotification });
});

exports.generateInvoice = asyncHandler(async (req, res) => {
  const { order_code } = req.params;

  const order = await Order.findOne({ order_code }).populate('items.product_id');
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  // Format date for invoice
  const invoiceDate = new Date().toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  // Generate watermark for paid orders
  const paidWatermark = order.status === 'paid' || order.status === 'complete' 
    ? `<div class="watermark">PAID</div>`
    : '';

  // Generate items HTML
  const itemsHtml = order.items.map(item => `
    <tr>
      <td class="item-name">${item.product_id.product_name}</td>
      <td class="item-qty">${item.quantity}</td>
      <td class="item-price">$${item.price.toFixed(2)}</td>
      <td class="item-amount">$${(item.price * item.quantity).toFixed(2)}</td>
    </tr>
  `).join('');

  const html = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invoice ${order.order_code}</title>
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
        font-size: 14px;
        line-height: 1.5;
        color: #333;
        background: #fff;
      }

      .invoice-container {
        max-width: 210mm;
        min-height: 297mm;
        margin: 0 auto;
        padding: 40mm 25mm 25mm 25mm;
        background: #fff;
        position: relative;
      }

      /* Watermark */
      .watermark {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) rotate(-45deg);
        font-size: 120px;
        font-weight: 900;
        color: rgba(0, 0, 0, 0.05);
        z-index: 1;
        pointer-events: none;
        user-select: none;
      }

      /* Header */
      .invoice-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 60px;
        position: relative;
        z-index: 2;
      }

      .logo-section {
        font-size: 12px;
        font-weight: 500;
        color: #666;
        line-height: 1.4;
      }

      .invoice-number {
        font-size: 12px;
        font-weight: 500;
        color: #666;
        text-align: right;
      }

      /* Title */
      .invoice-title {
        font-size: 64px;
        font-weight: 900;
        color: #000;
        margin-bottom: 40px;
        letter-spacing: -2px;
        position: relative;
        z-index: 2;
      }

      /* Date */
      .invoice-date {
        margin-bottom: 40px;
        position: relative;
        z-index: 2;
      }

      .invoice-date strong {
        font-weight: 600;
        color: #000;
      }

      /* Billing Info */
      .billing-info {
        display: flex;
        justify-content: space-between;
        margin-bottom: 60px;
        position: relative;
        z-index: 2;
      }

      .billing-section {
        width: 48%;
      }

      .billing-section h3 {
        font-size: 14px;
        font-weight: 600;
        color: #000;
        margin-bottom: 15px;
      }

      .billing-section p {
        font-size: 14px;
        color: #333;
        line-height: 1.6;
        margin-bottom: 5px;
      }

      /* Items Table */
      .items-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 40px;
        position: relative;
        z-index: 2;
      }

      .items-table thead {
        background: #f8f8f8;
      }

      .items-table th {
        padding: 16px 20px;
        text-align: left;
        font-size: 13px;
        font-weight: 600;
        color: #666;
        border-bottom: 1px solid #e5e5e5;
      }

      .items-table th:nth-child(2),
      .items-table th:nth-child(3),
      .items-table th:nth-child(4) {
        text-align: right;
      }

      .items-table td {
        padding: 16px 20px;
        border-bottom: 1px solid #f0f0f0;
        font-size: 14px;
        color: #333;
      }

      .item-name {
        font-weight: 500;
        color: #000;
      }

      .item-qty,
      .item-price,
      .item-amount {
        text-align: right;
        font-weight: 500;
      }

      /* Total Section */
      .total-section {
        display: flex;
        justify-content: flex-end;
        margin-bottom: 60px;
        position: relative;
        z-index: 2;
      }

      .total-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px 0;
        border-top: 2px solid #000;
        min-width: 300px;
      }

      .total-label {
        font-size: 18px;
        font-weight: 700;
        color: #000;
      }

      .total-amount {
        font-size: 18px;
        font-weight: 700;
        color: #000;
      }

      /* Footer Info */
      .footer-info {
        position: relative;
        z-index: 2;
      }

      .footer-info p {
        font-size: 14px;
        color: #333;
        margin-bottom: 12px;
      }

      .footer-info strong {
        font-weight: 600;
        color: #000;
      }

      /* Decorative Bottom Wave */
      .bottom-decoration {
        position: absolute;
        bottom: 0;
        left: 0;
        width: 100%;
        height: 120px;
        background: linear-gradient(135deg, #e5e5e5 0%, #666 100%);
        clip-path: ellipse(150% 100% at 50% 100%);
        z-index: 0;
      }

      /* Print Styles */
      @media print {
        body {
          margin: 0;
          padding: 0;
        }
        
        .invoice-container {
          max-width: none;
          padding: 20mm;
          box-shadow: none;
        }
        
        .watermark {
          color: rgba(0, 0, 0, 0.03) !important;
        }

        .bottom-decoration {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
      }
    </style>
  </head>
  <body>
    <div class="invoice-container">
      ${paidWatermark}
      
      <!-- Header -->
      <div class="invoice-header">
        <div class="logo-section">
          YOUR<br>
          LOGO
        </div>
        <div class="invoice-number">
          NO. ${order.order_code}
        </div>
      </div>

      <!-- Title -->
      <div class="invoice-title">INVOICE</div>

      <!-- Date -->
      <div class="invoice-date">
        <strong>Date:</strong> ${invoiceDate}
      </div>

      <!-- Billing Information -->
      <div class="billing-info">
        <div class="billing-section">
          <h3>Billed to:</h3>
          <p><strong>Customer</strong></p>
          <p>${order.billing_address || 'Address not provided'}</p>
        </div>
        <div class="billing-section">
          <h3>From:</h3>
          <p><strong>Your Company</strong></p>
          <p>${order.shipping_address || 'Company address'}</p>
        </div>
      </div>

      <!-- Items Table -->
      <table class="items-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Quantity</th>
            <th>Price</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <!-- Total -->
      <div class="total-section">
        <div class="total-row">
          <div class="total-label">Total</div>
          <div class="total-amount">$${order.total.toFixed(2)}</div>
        </div>
      </div>

      <!-- Footer Info -->
      <div class="footer-info">
        <p><strong>Payment method:</strong> ${order.payment_method || 'Not specified'}</p>
        <p><strong>Note:</strong> ${order.special_instructions || 'Thank you for choosing us!'}</p>
      </div>

      <!-- Bottom Decoration -->
      <div class="bottom-decoration"></div>
    </div>
  </body>
  </html>
  `;

  const options = {
    format: 'A4',
    orientation: 'portrait',
    border: {
      top: '0mm',
      right: '0mm',
      bottom: '0mm',
      left: '0mm'
    },
    quality: '100',
    type: 'pdf',
    timeout: 30000
  };

  pdf.create(html, options).toBuffer((err, buffer) => {
    if (err) {
      console.error('PDF Generation Error:', err);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to generate invoice PDF',
        error: err.message 
      });
    }
    
    res.writeHead(200, {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=invoice_${order.order_code}.pdf`,
      'Content-Length': buffer.length,
      'Cache-Control': 'no-cache'
    });
    res.end(buffer);
  });
});

// @desc Track order status by order_code
// @route GET /api/orders/:order_code/track
// @access Public
exports.trackOrderStatus = asyncHandler(async (req, res) => {
  const { order_code } = req.params;

  const order = await Order.findOne({ order_code });
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  let statusMessage;
  switch (order.status.toLowerCase()) {
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
      statusMessage = 'Your order status is: ' + order.status;
  }

  res.json({ 
    success: true, 
    data: {
      order_code: order.order_code,
      status: order.status,
      status_message: statusMessage,
      last_updated: order.updatedAt
    }
  });
});

// @desc Send manual notification for order
// @route POST /api/orders/:order_code/notify
// @access Private/Admin
exports.sendOrderNotification = asyncHandler(async (req, res) => {
  const { order_code } = req.params;
  const { type, title, message } = req.body;

  const order = await Order.findOne({ order_code });
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  if (!type || !title || !message) {
    return res.status(400).json({ 
      success: false, 
      message: 'Type, title, and message are required' 
    });
  }

  try {
    const data = {
      type: 'manual_notification',
      order_code,
      url: `/orders/${order_code}`
    };

   

    const response = {
      success: true,
      message: 'Notifications sent',
      results: {
        push: pushResult.status === 'fulfilled' ? pushResult.value : { success: false, error: pushResult.reason },
        email: emailResult.status === 'fulfilled' ? emailResult.value : { success: false, error: emailResult.reason }
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Failed to send manual notification:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send notification',
      error: error.message 
    });
  }
});

// @desc Send bulk notifications to all users with orders
// @route POST /api/orders/bulk-notify
// @access Private/Admin
// exports.sendBulkOrderNotifications = asyncHandler(async (req, res) => {
//   const { title, message, status_filter } = req.body;

//   if (!title || !message) {
//     return res.status(400).json({ 
//       success: false, 
//       message: 'Title and message are required' 
//     });
//   }

//   try {
//     // Build query based on status filter
//     let query = {};
//     if (status_filter && status_filter !== 'all') {
//       query.status = status_filter;
//     }

//     // Get unique user emails from orders
//     const orders = await Order.find(query).select('user.email');
//     const uniqueEmails = [...new Set(orders.map(order => order.user.email))];

//     if (uniqueEmails.length === 0) {
//       return res.status(404).json({ 
//         success: false, 
//         message: 'No users found matching the criteria' 
//       });
//     }

//     const data = {
//       type: 'bulk_notification',
//       sent_at: new Date().toISOString()
//     };

//     // Send bulk notification
//     const result = await oneSignalService.sendBulkNotification(uniqueEmails, title, message, data);

//     res.json({
//       success: true,
//       message: `Bulk notification sent to ${uniqueEmails.length} users`,
//       recipients_count: uniqueEmails.length,
//       notification_result: result
//     });
//   } catch (error) {
//     console.error('Failed to send bulk notifications:', error);
//     res.status(500).json({ 
//       success: false, 
//       message: 'Failed to send bulk notifications',
//       error: error.message 
//     });
//   }
// });

// @desc Update an order with Lalamove details
// @route PATCH /api/orders/:order_code/lalamove
// @access Private (user)
exports.updateOrderLalamove = asyncHandler(async (req, res) => {
  const { order_code } = req.params;
  const { lalamove_order_id, lalamove_share_url } = req.body;

  // Find the order
  const order = await Order.findOne({ order_code });
  if (!order) {
    return res.status(404).json({
      success: false,
      message: 'Order not found'
    });
  }

  // Optional: ensure this order belongs to the logged-in user
  if (req.user && order.user.username !== req.user.username) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to update this order'
    });
  }

  // Update order fields
  order.lalamove_order_id = lalamove_order_id;
  order.lalamove_share_url = lalamove_share_url;


  await order.save();

  res.json({
    success: true,
    message: 'Order updated with Lalamove details',
    data: {
      order_code: order.order_code,
      lalamove_order_id: order.lalamove_order_id,
      lalamove_share_url: order.lalamove_share_url
    }
  });
});

// @desc Get Lalamove tracking details for an order
// @route GET /api/orders/:order_code/lalamove/tracking
// @access Private (user)
exports.getLalamoveTracking = asyncHandler(async (req, res) => {
  const { order_code } = req.params;

  // Find the order
  const order = await Order.findOne({ order_code });
  if (!order) {
    return res.status(404).json({ 
      success: false, 
      message: 'Order not found' 
    });
  }

  // Check if user owns this order (optional security check)
  if (req.user && order.user.username !== req.user.username) {
    return res.status(403).json({ 
      success: false, 
      message: 'Not authorized to access this order' 
    });
  }

  if (!order.lalamove_order_id) {
    return res.status(404).json({ 
      success: false, 
      message: 'No Lalamove delivery found for this order' 
    });
  }

  res.json({ 
    success: true, 
    data: {
      order_code: order.order_code,
      lalamove_order_id: order.lalamove_order_id,
      lalamove_share_url: order.lalamove_share_url,
      delivery_type: order.delivery_type,
      status: order.status,
      tracking_available: !!order.lalamove_share_url
    }
  });
});