const mongoose = require('mongoose');

const GuestOrderSchema = new mongoose.Schema({
  order_code: { type: String, required: true, unique: true, trim: true },
  delivery_type: { type: String, enum: ['INSTANT', 'SCHEDULE_DELIVERY'] },
  lalamove_order_id: { type: String },
  lalamove_share_url: { type: String },
  // In case of scheduled delivery
  schedule_date: { type: String },
  
  // Guest customer information (no user reference)
  customer: {
    email: { type: String, required: true },
    full_name: { type: String, required: true },
    phone: { type: String, required: true }
  },
  
  // Session tracking
  session_id: { type: String, required: true }, // For tracking guest sessions
  
  items: [
    {
      product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
      quantity: { type: Number, required: true },
      original_price: { type: Number, required: true },
      price: { type: Number, required: true }, // Final price after discounts
      discount_amount: { type: Number, default: 0 },
      discount_applied: { type: Boolean, default: false },
      product_image: { type: String },
      product_name: { type: String } // Store product name for reference
    }
  ],
  
  total: { type: Number, required: true },
  
  payment_method: { 
    type: String, 
    required: true, 
    enum: ['PAYPAL', 'CARD'] // No wallet balance for guests
  },
  
  billing_address: { type: String, required: true },
  shipping_address: { type: String, required: true },
  
  status: {
    type: String,
    required: true,
    enum: [
      'pending', 
      'pending_payment', 
      'paid', 
      'processing', 
      'shipped', 
      'delivered', 
      'cancelled', 
      'refunded', 
      'on hold'
    ],
    default: 'pending'
  },
  
  special_instructions: { type: String, required: true },
  
  // PayPal specific fields
  paypal_payment_id: { type: String },
  paypal_payment_details: {
    payment_id: { type: String },
    payer_id: { type: String },
    state: { type: String },
    create_time: { type: String },
    update_time: { type: String },
    transactions: [{ type: mongoose.Schema.Types.Mixed }]
  },
  
  // Stripe specific fields
  payment_info: {
    stripe_payment_intent_id: { type: String },
    stripe_charge_id: { type: String },
    payment_method_id: { type: String },
    payment_status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' }
  },
  
  // Refund details (for all payment methods)
  refund_details: {
    refund_id: { type: String },
    amount: { type: mongoose.Schema.Types.Mixed },
    state: { type: String },
    reason: { type: String },
    create_time: { type: String },
    update_time: { type: String }
  },
  
  // Additional tracking fields
  payment_completed_at: { type: Date },
  shipped_at: { type: Date },
  delivered_at: { type: Date },
  
  // Shipping tracking
  tracking_number: { type: String },
  shipping_carrier: { type: String },
  
  // Notes and history (admin only)
  admin_notes: [
    {
      note: { type: String },
      created_by: { type: String },
      created_at: { type: Date, default: Date.now }
    }
  ],
  
  // Store discount information
  discount_summary: {
    totalOriginalAmount: { type: Number, default: 0 },
    totalFinalAmount: { type: Number, default: 0 },
    totalDiscountAmount: { type: Number, default: 0 },
    hasDiscounts: { type: Boolean, default: false },
    discountsApplied: [{ type: mongoose.Schema.Types.Mixed }]
  }
  
}, { timestamps: true });

// Indexes for better performance
GuestOrderSchema.index({ order_code: 1 });
GuestOrderSchema.index({ 'customer.email': 1 });
GuestOrderSchema.index({ session_id: 1 });
GuestOrderSchema.index({ status: 1 });
GuestOrderSchema.index({ payment_method: 1 });
GuestOrderSchema.index({ paypal_payment_id: 1 });
GuestOrderSchema.index({ createdAt: -1 });

// Middleware to update timestamps when status changes
GuestOrderSchema.pre('save', function(next) {
  if (this.isModified('status')) {
    if (this.status === 'paid' && !this.payment_completed_at) {
      this.payment_completed_at = new Date();
    } else if (this.status === 'shipped' && !this.shipped_at) {
      this.shipped_at = new Date();
    } else if (this.status === 'delivered' && !this.delivered_at) {
      this.delivered_at = new Date();
    }
  }
  next();
});

// Virtual for order age
GuestOrderSchema.virtual('orderAge').get(function() {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24)); // in days
});

// Virtual for payment status
GuestOrderSchema.virtual('isPaid').get(function() {
  return ['paid', 'processing', 'shipped', 'delivered', 'refunded'].includes(this.status);
});

// Virtual for can be cancelled
GuestOrderSchema.virtual('canBeCancelled').get(function() {
  return ['pending', 'pending_payment', 'paid'].includes(this.status);
});

// Virtual for can be refunded
GuestOrderSchema.virtual('canBeRefunded').get(function() {
  return ['paid', 'processing', 'shipped'].includes(this.status);
});

// Method to add admin note
GuestOrderSchema.methods.addAdminNote = function(note, adminUsername) {
  this.admin_notes.push({
    note,
    created_by: adminUsername,
    created_at: new Date()
  });
  return this.save();
};

// Method to get status history
GuestOrderSchema.methods.getStatusHistory = function() {
  const history = [];
  
  if (this.createdAt) {
    history.push({
      status: 'pending',
      timestamp: this.createdAt,
      description: 'Order created'
    });
  }
  
  if (this.payment_completed_at) {
    history.push({
      status: 'paid',
      timestamp: this.payment_completed_at,
      description: 'Payment completed'
    });
  }
  
  if (this.shipped_at) {
    history.push({
      status: 'shipped',
      timestamp: this.shipped_at,
      description: 'Order shipped'
    });
  }
  
  if (this.delivered_at) {
    history.push({
      status: 'delivered',
      timestamp: this.delivered_at,
      description: 'Order delivered'
    });
  }
  
  return history;
};

// Method to check if order is PayPal payment
GuestOrderSchema.methods.isPayPalPayment = function() {
  return this.payment_method === 'PAYPAL';
};

// Method to check if order is Stripe payment
GuestOrderSchema.methods.isStripePayment = function() {
  return this.payment_method === 'CARD';
};

// Ensure virtual fields are serialized
GuestOrderSchema.set('toJSON', { virtuals: true });
GuestOrderSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('GuestOrder', GuestOrderSchema);