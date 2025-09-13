// guestPaypalController.js
const paypal = require('paypal-rest-sdk');
const GuestOrder = require('../models/guestOrder');
const GuestCart = require('../models/guestCart');
const asyncHandler = require('../utils/asyncHandler');
const { customAlphabet } = require('nanoid');

// Configure PayPal (same as regular PayPal controller)
paypal.configure({
  'mode': process.env.PAYPAL_MODE, // 'sandbox' or 'live'
  'client_id': process.env.PAYPAL_CLIENT_ID,
  'client_secret': process.env.PAYPAL_CLIENT_SECRET
});

// @desc Create PayPal payment for guest order
// @route POST /api/guest-orders/paypal/create-payment
// @access Public
exports.createGuestPayment = asyncHandler(async (req, res) => {
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
      message: 'All required fields must be provided'
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

    // Calculate total using discounted prices
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

    // Prepare PayPal payment configuration
    const payment = {
      intent: 'sale',
      payer: {
        payment_method: 'paypal'
      },
      redirect_urls: {
        return_url: `${process.env.FRONTEND_URL}/guest/payment/success`,
        cancel_url: `${process.env.FRONTEND_URL}/guest/payment/cancel`
      },
      transactions: [{
        item_list: {
          items: items.map(item => ({
            name: item.product_name,
            sku: item.product_id,
            price: item.price.toFixed(2),
            currency: 'USD',
            quantity: item.quantity
          }))
        },
        amount: {
          currency: 'USD',
          total: finalTotal.toFixed(2),
          details: {
            subtotal: total.toFixed(2),
            tax: '0.00',
            shipping: subtotalAdjustments.toFixed(2)
          }
        },
        description: `Guest Order ${order_code} - ${items.length} item(s)`,
        custom: JSON.stringify({
          order_code,
          guest_cart_code,
          session_id,
          customer_email: customer.email,
          is_guest_order: true
        })
      }]
    };

    // Create PayPal payment
    paypal.payment.create(payment, (error, payment) => {
      if (error) {
        console.error('PayPal Payment Creation Error:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to create PayPal payment',
          error: error.message
        });
      }

      // Store payment info temporarily - you might want to use a temporary storage
      // or extend your GuestOrder model to include pending payments

      const approvalUrl = payment.links.find(link => link.rel === 'approval_url').href;

      res.json({
        success: true,
        payment_id: payment.id,
        approval_url: approvalUrl,
        order_code
      });
    });

  } catch (error) {
    console.error('Guest PayPal Payment Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create guest PayPal payment',
      error: error.message
    });
  }
});

// @desc Execute PayPal payment for guest order
// @route POST /api/guest-orders/paypal/execute-payment
// @access Public
exports.executeGuestPayment = asyncHandler(async (req, res) => {
  const {
    paymentId,
    PayerID,
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

  if (!paymentId || !PayerID || !order_code || !guest_cart_code || !customer || !session_id) {
    return res.status(400).json({
      success: false,
      message: 'Payment ID, Payer ID, order code, guest cart code, customer info, and session ID are required'
    });
  }

  try {
    // Execute PayPal payment
    const execute_payment_json = {
      payer_id: PayerID
    };

    paypal.payment.execute(paymentId, execute_payment_json, async (error, payment) => {
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
          message: 'PayPal payment not approved'
        });
      }

      try {
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

        // Prepare order data
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

        // Create guest order with PayPal payment details
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
          payment_method: 'PAYPAL',
          paypal_payment_id: payment.id,
          paypal_payment_details: {
            payment_id: payment.id,
            payer_id: payment.payer.payer_info.payer_id,
            state: payment.state,
            create_time: payment.create_time,
            update_time: payment.update_time,
            transactions: payment.transactions
          },
          billing_address,
          shipping_address,
          status: 'paid', // Mark as paid since PayPal payment succeeded
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
          message: 'PayPal payment successful and guest order created',
          new_guest_cart_code: newGuestCart.cart_code
        });

      } catch (dbError) {
        console.error('Database Error after PayPal execution:', dbError);
        res.status(500).json({
          success: false,
          message: 'Payment successful but failed to create order',
          error: dbError.message
        });
      }
    });

  } catch (error) {
    console.error('Guest PayPal Execution Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to execute guest PayPal payment',
      error: error.message
    });
  }
});

// @desc Cancel PayPal payment for guest order
// @route POST /api/guest-orders/paypal/cancel-payment
// @access Public
exports.cancelGuestPayment = asyncHandler(async (req, res) => {
  const { payment_id, order_code, session_id } = req.body;

  if (!payment_id) {
    return res.status(400).json({
      success: false,
      message: 'Payment ID is required'
    });
  }

  try {
    // Get payment details from PayPal
    paypal.payment.get(payment_id, (error, payment) => {
      if (error) {
        console.error('PayPal Payment Get Error:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to get payment details',
          error: error.message
        });
      }

      res.json({
        success: true,
        message: 'Guest payment cancelled successfully',
        payment_state: payment.state,
        order_code
      });
    });

  } catch (error) {
    console.error('Guest PayPal Cancel Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel guest payment',
      error: error.message
    });
  }
});

// @desc Get PayPal payment status for guest order
// @route GET /api/guest-orders/paypal/payment/:payment_id
// @access Public
exports.getGuestPaymentStatus = asyncHandler(async (req, res) => {
  const { payment_id } = req.params;
  const { session_id } = req.query;

  if (!payment_id) {
    return res.status(400).json({
      success: false,
      message: 'Payment ID is required'
    });
  }

  try {
    paypal.payment.get(payment_id, (error, payment) => {
      if (error) {
        console.error('PayPal Get Payment Error:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to get payment status',
          error: error.message
        });
      }

      res.json({
        success: true,
        data: {
          payment_id: payment.id,
          state: payment.state,
          create_time: payment.create_time,
          update_time: payment.update_time,
          total: payment.transactions[0].amount.total,
          currency: payment.transactions[0].amount.currency
        }
      });
    });

  } catch (error) {
    console.error('Guest PayPal Status Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get guest payment status',
      error: error.message
    });
  }
});

// @desc Refund PayPal payment for guest order (Admin only)
// @route POST /api/guest-orders/paypal/refund
// @access Private/Admin
exports.refundGuestPayment = asyncHandler(async (req, res) => {
  const { order_code, amount, reason } = req.body;

  if (!order_code) {
    return res.status(400).json({
      success: false,
      message: 'Order code is required'
    });
  }

  try {
    // Find the guest order
    const guestOrder = await GuestOrder.findOne({ order_code });

    if (!guestOrder) {
      return res.status(404).json({
        success: false,
        message: 'Guest order not found'
      });
    }

    if (!guestOrder.paypal_payment_id) {
      return res.status(400).json({
        success: false,
        message: 'No PayPal payment found for this guest order'
      });
    }

    // Get the sale transaction from the payment
    const saleId = guestOrder.paypal_payment_details.transactions[0].related_resources[0].sale.id;

    const refund_data = {
      amount: {
        total: amount || guestOrder.total.toFixed(2),
        currency: 'USD'
      },
      reason: reason || 'Guest order refund'
    };

    // Process refund through PayPal
    paypal.sale.refund(saleId, refund_data, async (error, refund) => {
      if (error) {
        console.error('PayPal Refund Error:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to process refund',
          error: error.message
        });
      }

      try {
        // Update guest order with refund details
        guestOrder.refund_details = {
          refund_id: refund.id,
          amount: refund.amount,
          state: refund.state,
          reason: reason || 'Guest order refund',
          create_time: refund.create_time,
          update_time: refund.update_time
        };
        guestOrder.status = 'refunded';

        await guestOrder.save();

        res.json({
          success: true,
          message: 'Guest order refunded successfully',
          refund_data: refund,
          order: guestOrder
        });

      } catch (dbError) {
        console.error('Database Error during guest refund:', dbError);
        res.status(500).json({
          success: false,
          message: 'Refund processed but failed to update order',
          error: dbError.message
        });
      }
    });

  } catch (error) {
    console.error('Guest Refund Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process guest refund',
      error: error.message
    });
  }
});