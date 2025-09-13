// stripeController.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Order = require('../models/order');
const Cart = require('../models/cart');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const { customAlphabet } = require('nanoid');

// @desc Create Stripe payment intent
// @route POST /api/stripe/create-payment-intent
// @access Private
exports.createPaymentIntent = asyncHandler(async (req, res) => {
  const {
    order_code,
    cart_code,
    billing_address,
    shipping_address,
    special_instructions
  } = req.body;

  if (!order_code || !cart_code || !billing_address || !shipping_address) {
    return res.status(400).json({ 
      success: false, 
      message: 'Order code, cart code, billing address, and shipping address are required' 
    });
  }

  try {
    // Check if order_code already exists
    const existingOrder = await Order.findOne({ order_code });
    if (existingOrder) {
      return res.status(400).json({ 
        success: false, 
        message: 'Order code already exists' 
      });
    }

    // Fetch cart
    const cart = await Cart.findOne({ cart_code });
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

    // Calculate total using discounted prices (same logic as regular orders)
    const items = cart.products.map(p => ({
      product_id: p.product_id,
      quantity: p.quantity,
      original_price: p.price || 0,
      price: p.finalPrice || p.price || 0,
      discount_amount: p.discountAmount || 0,
      discount_applied: p.discountApplied || false,
      product_image: p.product_image || null
    }));

    const total = items.reduce((acc, item) => {
      const itemPrice = parseFloat(item.price) || 0;
      const quantity = parseInt(item.quantity) || 0;
      return acc + (itemPrice * quantity);
    }, 0);

    const subtotalAdjustments = (cart.subtotal || []).reduce((acc, item) => {
      const value = parseFloat(item.value) || 0;
      return acc + value;
    }, 0);

    const finalTotal = Math.max(0, total + subtotalAdjustments);
    
    // Convert to cents for Stripe (Stripe expects amounts in cents)
    const amountInCents = Math.round(finalTotal * 100);

    // Create Stripe PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        order_code,
        cart_code,
        user_id: user._id.toString(),
        username: user.username
      },
      description: `Order ${order_code} - ${items.length} item(s)`,
      shipping: {
        address: {
          line1: typeof shipping_address === 'object' ? shipping_address.address_line_1 : shipping_address,
          line2: typeof shipping_address === 'object' ? shipping_address.address_line_2 : null,
          city: typeof shipping_address === 'object' ? shipping_address.city : null,
          state: typeof shipping_address === 'object' ? shipping_address.state : null,
          postal_code: typeof shipping_address === 'object' ? shipping_address.postal_code : null,
          country: typeof shipping_address === 'object' ? shipping_address.country : 'US',
        },
        name: user.full_name || user.username,
        phone: user.phone || null,
      },
      receipt_email: user.email,
    });

    // Store payment intent data temporarily (you might want to use Redis or similar)
    // For now, we'll store it in a temporary collection or in memory
    // You can also extend your Order model to include payment_intent_id for pending orders

    res.json({
      success: true,
      data: {
        client_secret: paymentIntent.client_secret,
        payment_intent_id: paymentIntent.id,
        amount: finalTotal,
        order_code
      }
    });

  } catch (error) {
    console.error('Stripe Payment Intent Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create payment intent',
      error: error.message
    });
  }
});

// @desc Confirm Stripe payment and create order
// @route POST /api/stripe/confirm-payment
// @access Private
exports.confirmPayment = asyncHandler(async (req, res) => {
  const {
    payment_intent_id,
    order_code,
    cart_code,
    billing_address,
    shipping_address,
    special_instructions,
    lalamove_order_id,
    lalamove_share_url
  } = req.body;

  if (!payment_intent_id || !order_code || !cart_code) {
    return res.status(400).json({
      success: false,
      message: 'Payment intent ID, order code, and cart code are required'
    });
  }

  try {
    // Retrieve the payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);
    
    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({
        success: false,
        message: 'Payment not completed successfully'
      });
    }

    // Verify the payment intent matches our order
    if (paymentIntent.metadata.order_code !== order_code) {
      return res.status(400).json({
        success: false,
        message: 'Payment intent does not match order'
      });
    }

    // Check if order already exists
    const existingOrder = await Order.findOne({ order_code });
    if (existingOrder) {
      return res.status(400).json({
        success: false,
        message: 'Order already exists'
      });
    }

    // Fetch cart and user (same as regular order creation)
    const cart = await Cart.findOne({ cart_code });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    const user = await User.findOne({ username: cart.username });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prepare order data (same logic as regular orders)
    const items = cart.products.map(p => ({
      product_id: p.product_id,
      quantity: p.quantity,
      original_price: p.price || 0,
      price: p.finalPrice || p.price || 0,
      discount_amount: p.discountAmount || 0,
      discount_applied: p.discountApplied || false,
      product_image: p.product_image || null
    }));

    const total = items.reduce((acc, item) => {
      const itemPrice = parseFloat(item.price) || 0;
      const quantity = parseInt(item.quantity) || 0;
      return acc + (itemPrice * quantity);
    }, 0);

    const subtotalAdjustments = (cart.subtotal || []).reduce((acc, item) => {
      const value = parseFloat(item.value) || 0;
      return acc + value;
    }, 0);

    const finalTotal = Math.max(0, total + subtotalAdjustments);

    // Create order with Stripe payment info
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
      total: parseFloat(finalTotal.toFixed(2)),
      lalamove_order_id: lalamove_order_id,
      lalamove_share_url: lalamove_share_url,
      payment_method: 'CARD',
      payment_info: {
        stripe_payment_intent_id: payment_intent_id,
        stripe_charge_id: paymentIntent.latest_charge,
        payment_method_id: paymentIntent.payment_method,
        payment_status: 'completed'
      },
      billing_address,
      shipping_address,
      status: 'paid', // Mark as paid since Stripe payment succeeded
      special_instructions: special_instructions || 'No special instructions',
      discount_summary: cart.discountInfo || null
    });

    // Delete cart after successful order creation
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

    res.status(201).json({
      success: true,
      data: order,
      message: 'Payment successful and order created',
      new_cart_code: newCart
    });

  } catch (error) {
    console.error('Stripe Payment Confirmation Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to confirm payment and create order',
      error: error.message
    });
  }
});

// @desc Handle Stripe webhooks
// @route POST /api/stripe/webhook
// @access Public (but verify with Stripe signature)
exports.handleWebhook = asyncHandler(async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      console.log('Payment succeeded:', paymentIntent.id);
      
      // You can add additional logic here for successful payments
      // For example, send confirmation emails, update inventory, etc.
      break;

    case 'payment_intent.payment_failed':
      const failedPayment = event.data.object;
      console.log('Payment failed:', failedPayment.id);
      
      // Handle failed payments
      // You might want to notify the user or retry the payment
      break;

    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
});

// @desc Get saved payment methods for user
// @route GET /api/stripe/payment-methods
// @access Private
exports.getPaymentMethods = asyncHandler(async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || !user.stripe_customer_id) {
      return res.json({
        success: true,
        data: []
      });
    }

    const paymentMethods = await stripe.paymentMethods.list({
      customer: user.stripe_customer_id,
      type: 'card',
    });

    res.json({
      success: true,
      data: paymentMethods.data
    });

  } catch (error) {
    console.error('Error fetching payment methods:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment methods',
      error: error.message
    });
  }
});

// @desc Save payment method for future use
// @route POST /api/stripe/save-payment-method
// @access Private
exports.savePaymentMethod = asyncHandler(async (req, res) => {
  const { payment_method_id } = req.body;

  if (!payment_method_id) {
    return res.status(400).json({
      success: false,
      message: 'Payment method ID is required'
    });
  }

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Create Stripe customer if doesn't exist
    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.full_name,
        metadata: {
          user_id: user._id.toString(),
          username: user.username
        }
      });
      customerId = customer.id;
      
      // Update user with Stripe customer ID
      await User.findByIdAndUpdate(user._id, {
        stripe_customer_id: customerId
      });
    }

    // Attach payment method to customer
    await stripe.paymentMethods.attach(payment_method_id, {
      customer: customerId,
    });

    res.json({
      success: true,
      message: 'Payment method saved successfully'
    });

  } catch (error) {
    console.error('Error saving payment method:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save payment method',
      error: error.message
    });
  }
});