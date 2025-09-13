const Order = require('../models/order');
const Cart = require('../models/cart');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const paypal = require('paypal-rest-sdk');

// Configure PayPal
paypal.configure({
  mode: process.env.PAYPAL_MODE || 'sandbox', // sandbox or live
  client_id: process.env.PAYPAL_CLIENT_ID,
  client_secret: process.env.PAYPAL_CLIENT_SECRET
});

// Helper function to create a short SKU from ObjectId
const createShortSku = (objectId) => {
  return objectId.toString().slice(-12).toUpperCase(); // Last 12 characters
};

// Helper function to create minimal custom data
const createMinimalCustomData = (orderData) => {
  return JSON.stringify({
    oc: orderData.order_code,
    cc: orderData.cart_code,
    uid: orderData.user_id,
    un: orderData.username,
    em: orderData.email,
    fn: orderData.full_name,
    tt: orderData.total
  });
};

// @desc Create PayPal payment
// @route POST /api/paypal/create-payment
// @access Private
exports.createPayment = asyncHandler(async (req, res) => {
  const {
    cart_code,
    billing_address,
    shipping_address,
    special_instructions,
    return_url,
    cancel_url,
    
  } = req.body;

  // Validation
  if (!cart_code || !billing_address || !shipping_address) {
    return res.status(400).json({ 
      success: false, 
      message: 'Cart code, billing address, and shipping address are required' 
    });
  }

  if (!return_url || !cancel_url) {
    return res.status(400).json({
      success: false,
      message: 'Return URL and Cancel URL are required'
    });
  }

  // Fetch cart
  const cart = await Cart.findOne({ cart_code }).populate('products.product_id');
  if (!cart) {
    return res.status(404).json({ 
      success: false, 
      message: 'Cart not found' 
    });
  }

  if (!cart.products || cart.products.length === 0) {
    return res.status(400).json({ 
      success: false, 
      message: 'Cart is empty' 
    });
  }

  // Fetch user based on cart.username
  const user = await User.findOne({ username: cart.username });
  if (!user) {
    return res.status(404).json({ 
      success: false, 
      message: 'User not found' 
    });
  }

  // Generate unique order code for reference
  const order_code = 'ORD-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9).toUpperCase();

  // Prepare items array for PayPal with length constraints
  const paypalItems = cart.products.map((p, index) => {
    const productName = p.product_id?.product_name || `Product #${p.product_id.toString().slice(-6)}`;
    const finalPrice = p.finalPrice || p.price;
    
    return {
      name: productName.substring(0, 127), // PayPal limits item names to 127 characters
      sku: createShortSku(p.product_id), // Use shortened SKU
      price: finalPrice.toFixed(2),
      currency: 'USD',
      quantity: p.quantity
    };
  });

  // Calculate total using finalPrice (includes discounts)
  const subtotal = cart.products.reduce((acc, item) => {
    const finalPrice = item.finalPrice || item.price;
    return acc + (finalPrice * item.quantity);
  }, 0);

  const total = cart.total || subtotal;

  // Create complete order data for our database (store separately from PayPal)
  const completeOrderData = {
    order_code,
    cart_code,
    user_id: user._id.toString(),
    username: user.username,
    email: user.email,
    full_name: user.full_name,
    profile_picture: user.profile_picture || null,
    billing_address,
    shipping_address,
    special_instructions: special_instructions || 'No special instructions',
    items: cart.products.map(p => ({
      product_id: p.product_id,
      quantity: p.quantity,
      price: p.finalPrice || p.price,
      product_image: p.product_image || null
    })),
    total,
    discount_summary: cart.discountInfo || null
  };

  // Store complete order data temporarily (you could use Redis or a temporary collection)
  // For now, we'll store it in a simple in-memory cache or you could create a PendingOrder model
  global.pendingOrders = global.pendingOrders || {};
  global.pendingOrders[order_code] = completeOrderData;

  // Create minimal custom data for PayPal (under 256 chars)
  const minimalCustomData = createMinimalCustomData(completeOrderData);

  const paymentObject = {
    intent: 'sale',
    payer: {
      payment_method: 'paypal'
    },
    redirect_urls: {
      return_url: `${return_url}?order_code=${order_code}&cart_code=${cart_code}`,
      cancel_url: `${cancel_url}?order_code=${order_code}&cart_code=${cart_code}`
    },
    transactions: [{
      amount: {
        currency: 'USD',
        total: total.toFixed(2)
      },
      description: `Order ${order_code} - ${cart.products.length} item(s) from Cart ${cart_code}`,
      custom: minimalCustomData,
      invoice_number: order_code
      // Removed item_list entirely to avoid amount validation issues
    }]
  };

  // Create PayPal payment
  paypal.payment.create(paymentObject, (error, payment) => {
    if (error) {
      console.error('PayPal Payment Creation Error:', error);
      
      // Clean up pending order data
      if (global.pendingOrders && global.pendingOrders[order_code]) {
        delete global.pendingOrders[order_code];
      }
      
      return res.status(500).json({
        success: false,
        message: 'Failed to create PayPal payment',
        error: error
      });
    }

    // Find approval URL
    const approvalUrl = payment.links.find(link => link.rel === 'approval_url');
    
    if (!approvalUrl) {
      // Clean up pending order data
      if (global.pendingOrders && global.pendingOrders[order_code]) {
        delete global.pendingOrders[order_code];
      }
      
      return res.status(500).json({
        success: false,
        message: 'PayPal approval URL not found'
      });
    }

    res.status(201).json({
      success: true,
      message: 'PayPal payment created successfully',
      data: {
        order_code,
        payment_id: payment.id,
        approval_url: approvalUrl.href,
        cart_code,
        total
      }
    });
  });
});

// @desc Execute PayPal payment after user approval
// @route POST /api/paypal/execute-payment
// @access Private
exports.executePayment = asyncHandler(async (req, res) => {
  const { payment_id, payer_id, order_code, cart_code, lalamove_order_id, lalamove_share_url } = req.body;

  if (!payment_id || !payer_id) {
    return res.status(400).json({
      success: false,
      message: 'Payment ID and Payer ID are required'
    });
  }

  // Execute PayPal payment first
  const executePaymentObject = {
    payer_id: payer_id
  };

  paypal.payment.execute(payment_id, executePaymentObject, async (error, payment) => {
    if (error) {
      console.error('PayPal Payment Execution Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to execute PayPal payment',
        error: error.message
      });
    }

    if (payment.state !== 'approved') {
      return res.status(400).json({
        success: false,
        message: 'PayPal payment not approved',
        payment_state: payment.state
      });
    }

    try {
      // Get order data from our temporary storage
      let orderData;
      
      if (global.pendingOrders && global.pendingOrders[order_code]) {
        orderData = global.pendingOrders[order_code];
        // Clean up after use
        delete global.pendingOrders[order_code];
      } else {
        // Fallback: parse minimal data from PayPal custom field
        const minimalData = JSON.parse(payment.transactions[0].custom);
        
        // We need to reconstruct the order data - fetch cart and user again
        const cart = await Cart.findOne({ cart_code: minimalData.cc }).populate('products.product_id');
        const user = await User.findOne({ _id: minimalData.uid });
        
        if (!cart || !user) {
          return res.status(400).json({
            success: false,
            message: 'Cart or user no longer exists'
          });
        }
        
        // Reconstruct order data (you might want to store billing/shipping addresses differently)
        orderData = {
          order_code: minimalData.oc,
          cart_code: minimalData.cc,
          user_id: minimalData.uid,
          username: minimalData.un,
          email: minimalData.em,
          full_name: minimalData.fn,
          profile_picture: user.profile_picture,
          billing_address: req.body.billing_address, // You might need to pass this
          shipping_address: req.body.shipping_address, // You might need to pass this
          special_instructions: req.body.special_instructions || 'No special instructions',
          items: cart.products.map(p => ({
            product_id: p.product_id,
            quantity: p.quantity,
            price: p.finalPrice || p.price,
            product_image: p.product_image || null
          })),
          total: minimalData.tt,
          discount_summary: cart.discountInfo || null
        };
      }
      
      // Verify cart still exists and hasn't been modified
      const cart = await Cart.findOne({ cart_code: orderData.cart_code });
      if (!cart) {
        return res.status(400).json({
          success: false,
          message: 'Cart no longer exists or has been modified'
        });
      }

      // Check if order already exists (prevent double processing)
      const existingOrder = await Order.findOne({ order_code: orderData.order_code });
      if (existingOrder) {
        return res.status(400).json({
          success: false,
          message: 'Order already exists',
          data: { order: existingOrder }
        });
      }

      // Now create the order with paid status
      const order = await Order.create({
        order_code: orderData.order_code,
        user: {
          _id: orderData.user_id,
          username: orderData.username,
          email: orderData.email,
          full_name: orderData.full_name,
          profile_picture: orderData.profile_picture
        },
        items: orderData.items,
        total: orderData.total,
        payment_method: 'PAYPAL',
        lalamove_order_id: lalamove_order_id,
        lalamove_share_url: lalamove_share_url,
        billing_address: orderData.billing_address,
        shipping_address: orderData.shipping_address,
        status: 'paid', // Order is created as paid since PayPal payment is complete
        special_instructions: orderData.special_instructions,
        discount_summary: orderData.discount_summary,
        paypal_payment_id: payment.id,
        paypal_payment_details: {
          payment_id: payment.id,
          payer_id: payer_id,
          state: payment.state,
          create_time: payment.create_time,
          update_time: payment.update_time,
          transactions: payment.transactions
        },
        payment_completed_at: new Date()
      });

      // Delete cart after successful order creation
      await Cart.findOneAndDelete({ cart_code: orderData.cart_code });

      // Send success response
      res.json({
        success: true,
        message: 'Payment executed successfully and order created',
        data: {
          order,
          payment_details: payment
        }
      });

      // Optional: Send notifications here
      // await sendPaymentSuccessNotification(order);

    } catch (saveError) {
      console.error('Error creating order after PayPal execution:', saveError);
      
      // Payment was successful but order creation failed
      // This is a critical error that needs manual intervention
      res.status(500).json({
        success: false,
        message: 'Payment processed successfully but failed to create order. Please contact support.',
        error: saveError.message,
        payment_id: payment.id,
        order_code: order_code
      });
    }
  });
});

// @desc Cancel PayPal payment
// @route POST /api/paypal/cancel-payment
// @access Private
exports.cancelPayment = asyncHandler(async (req, res) => {
  const { order_code, payment_id, cart_code } = req.body;

  // Clean up any pending order data
  if (order_code && global.pendingOrders && global.pendingOrders[order_code]) {
    delete global.pendingOrders[order_code];
  }

  res.json({
    success: true,
    message: 'PayPal payment cancelled',
    data: { 
      order_code: order_code || null,
      payment_id: payment_id || null,
      cart_code: cart_code || null
    }
  });
});

// @desc Get PayPal payment details
// @route GET /api/paypal/payment/:paymentId
// @access Private
exports.getPaymentStatus = asyncHandler(async (req, res) => {
  const { paymentId } = req.params;

  if (!paymentId) {
    return res.status(400).json({
      success: false,
      message: 'Payment ID is required'
    });
  }

  paypal.payment.get(paymentId, (error, payment) => {
    if (error) {
      console.error('PayPal Get Payment Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve PayPal payment details',
        error: error.message
      });
    }

    // Also get our order details if payment is completed
    Order.findOne({ paypal_payment_id: paymentId })
      .then(order => {
        res.json({
          success: true,
          data: {
            paypal_payment: payment,
            order: order
          }
        });
      })
      .catch(orderError => {
        res.json({
          success: true,
          data: {
            paypal_payment: payment,
            order: null,
            order_note: 'Order not yet created (payment may not be completed)'
          }
        });
      });
  });
});

// @desc Refund PayPal payment
// @route POST /api/paypal/refund
// @access Private/Admin
exports.refundPayment = asyncHandler(async (req, res) => {
  const { order_code, refund_amount, reason } = req.body;

  if (!order_code) {
    return res.status(400).json({
      success: false,
      message: 'Order code is required'
    });
  }

  // Find the order
  const order = await Order.findOne({ order_code });
  if (!order) {
    return res.status(404).json({
      success: false,
      message: 'Order not found'
    });
  }

  if (order.payment_method !== 'PAYPAL' || !order.paypal_payment_details) {
    return res.status(400).json({
      success: false,
      message: 'Order was not paid via PayPal'
    });
  }

  if (order.status === 'refunded') {
    return res.status(400).json({
      success: false,
      message: 'Order has already been refunded'
    });
  }

  // Get the sale transaction ID from the payment details
  const transactions = order.paypal_payment_details.transactions || [];
  let saleTransaction = null;

  for (const transaction of transactions) {
    if (transaction.related_resources) {
      for (const resource of transaction.related_resources) {
        if (resource.sale) {
          saleTransaction = resource.sale;
          break;
        }
      }
    }
    if (saleTransaction) break;
  }

  if (!saleTransaction) {
    return res.status(400).json({
      success: false,
      message: 'Sale transaction not found in payment details'
    });
  }

  const saleId = saleTransaction.id;
  const refundData = {
    amount: {
      currency: 'USD',
      total: refund_amount ? refund_amount.toFixed(2) : order.total.toFixed(2)
    },
    reason: reason || 'Order refund requested'
  };

  // Process refund with PayPal
  paypal.sale.refund(saleId, refundData, async (error, refund) => {
    if (error) {
      console.error('PayPal Refund Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to process PayPal refund',
        error: error.message
      });
    }

    try {
      // Update order status
      order.status = 'refunded';
      order.refund_details = {
        refund_id: refund.id,
        amount: refund.amount,
        state: refund.state,
        reason: reason,
        create_time: refund.create_time,
        update_time: refund.update_time
      };
      
      await order.save();

      res.json({
        success: true,
        message: 'PayPal refund processed successfully',
        data: {
          order,
          refund_details: refund
        }
      });

    } catch (saveError) {
      console.error('Error saving refund details:', saveError);
      res.status(500).json({
        success: false,
        message: 'Refund processed but failed to update order',
        error: saveError.message
      });
    }
  });
});