// guestStripeController.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const GuestOrder = require('../models/guestOrder');
const GuestCart = require('../models/guestCart');
const asyncHandler = require('../utils/asyncHandler');
const { customAlphabet } = require('nanoid');

// @desc Create Stripe payment intent for guest order
// @route POST /api/guest-orders/stripe/create-payment-intent
// @access Public
exports.createGuestPaymentIntent = asyncHandler(async (req, res) => {
  const {
    order_code,
    guest_cart_code,
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

  if (!order_code || !guest_cart_code || !billing_address || !shipping_address || !customer || !session_id) {
    return res.status(400).json({ 
      success: false, 
      message: 'Order code, guest cart code, billing address, shipping address, customer info, and session ID are required' 
    });
  }

  // Validate customer info
  if (!customer.email || !customer.full_name || !customer.phone) {
    return res.status(400).json({ 
      success: false, 
      message: 'Customer email, full name, and phone are required' 
    });
  }

  try {
    // Check if order_code already exists
    const existingOrder = await GuestOrder.findOne({ order_code });
    if (existingOrder) {
      return res.status(400).json({ 
        success: false, 
        message: 'Order code already exists' 
      });
    }

    // Fetch guest cart
    const guestCart = await GuestCart.findOne({ 
      cart_code: guest_cart_code,
      session_id: session_id
    });
    
    if (!guestCart) {
      return res.status(404).json({ 
        success: false, 
        message: 'Guest cart not found' 
      });
    }

    if (!guestCart.products || guestCart.products.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Guest cart is empty' 
      });
    }

    // Calculate total using discounted prices (same logic as regular orders)
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

    const total = items.reduce((acc, item) => {
      const itemPrice = parseFloat(item.price) || 0;
      const quantity = parseInt(item.quantity) || 0;
      return acc + (itemPrice * quantity);
    }, 0);

    const subtotalAdjustments = (guestCart.subtotal || []).reduce((acc, item) => {
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
        guest_cart_code,
        session_id,
        customer_email: customer.email,
        is_guest_order: 'true'
      },
      description: `Guest Order ${order_code} - ${items.length} item(s)`,
      shipping: {
        address: {
          line1: typeof shipping_address === 'object' ? shipping_address.address_line_1 : shipping_address,
          line2: typeof shipping_address === 'object' ? shipping_address.address_line_2 : null,
          city: typeof shipping_address === 'object' ? shipping_address.city : null,
          state: typeof shipping_address === 'object' ? shipping_address.state : null,
          postal_code: typeof shipping_address === 'object' ? shipping_address.postal_code : null,
          country: typeof shipping_address === 'object' ? shipping_address.country : 'US',
        },
        name: customer.full_name,
        phone: customer.phone,
      },
      receipt_email: customer.email,
    });

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
    console.error('Guest Stripe Payment Intent Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create payment intent',
      error: error.message
    });
  }
});

// @desc Confirm Stripe payment and create guest order
// @route POST /api/guest-orders/stripe/confirm-payment
// @access Public
exports.confirmGuestPayment = asyncHandler(async (req, res) => {
  const {
    payment_intent_id,
    order_code,
    guest_cart_code,
    billing_address,
    shipping_address,
    special_instructions,
    delivery_type,
    schedule,
    lalamove_order_id,
    lalamove_share_url,
    customer,
    session_id
  } = req.body;

  if (!payment_intent_id || !order_code || !guest_cart_code || !customer || !session_id) {
    return res.status(400).json({
      success: false,
      message: 'Payment intent ID, order code, guest cart code, customer info, and session ID are required'
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

    // Check if guest order already exists
    const existingOrder = await GuestOrder.findOne({ order_code });
    if (existingOrder) {
      return res.status(400).json({
        success: false,
        message: 'Guest order already exists'
      });
    }

    // Fetch guest cart
    const guestCart = await GuestCart.findOne({ 
      cart_code: guest_cart_code,
      session_id: session_id
    });
    
    if (!guestCart) {
      return res.status(404).json({
        success: false,
        message: 'Guest cart not found'
      });
    }

    // Prepare order data (same logic as regular orders)
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

    const total = items.reduce((acc, item) => {
      const itemPrice = parseFloat(item.price) || 0;
      const quantity = parseInt(item.quantity) || 0;
      return acc + (itemPrice * quantity);
    }, 0);

    const subtotalAdjustments = (guestCart.subtotal || []).reduce((acc, item) => {
      const value = parseFloat(item.value) || 0;
      return acc + value;
    }, 0);

    const finalTotal = Math.max(0, total + subtotalAdjustments);

    // Create guest order with Stripe payment info
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
      delivery_type: delivery_type,
      schedule_date: schedule,
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
      discount_summary: guestCart.discountInfo || null
    });

    // Delete guest cart after successful order creation
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
      message: 'Payment successful and guest order created',
      new_guest_cart_code: newGuestCart.cart_code
    });

  } catch (error) {
    console.error('Guest Stripe Payment Confirmation Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to confirm payment and create guest order',
      error: error.message
    });
  }
});

// @desc Handle Stripe webhooks for guest orders
// @route POST /api/guest-orders/stripe/webhook
// @access Public (but verify with Stripe signature)
exports.handleGuestWebhook = asyncHandler(async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET_GUEST; // Separate webhook secret for guest orders

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('Guest webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      console.log('Guest payment succeeded:', paymentIntent.id);
      
      // Check if this is a guest order
      if (paymentIntent.metadata.is_guest_order === 'true') {
        // You can add additional logic here for successful guest payments
        // For example, send confirmation emails, update inventory, etc.
      }
      break;

    case 'payment_intent.payment_failed':
      const failedPayment = event.data.object;
      console.log('Guest payment failed:', failedPayment.id);
      
      // Handle failed guest payments
      if (failedPayment.metadata.is_guest_order === 'true') {
        // You might want to send failure notification emails
      }
      break;

    default:
      console.log(`Unhandled guest webhook event type ${event.type}`);
  }

  res.json({ received: true });
});