const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  order_code: { type: String, required: true, unique: true, trim: true },
  delivery_type:{type:String, enum: ['INSTANT', 'SCHEDULE_DELIVERY', 'POS', "PICK_UP", "DELIVERY"]},
  lalamove_order_id: {type:String},
  lalamove_share_url: {type:String},
  // incase schedule delivery
  schedule_date: {type:String},
  user: {
    _id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // override with random values if the order is POS
    username: { type: String, required: true }, // cashiers name if the order is POS
    email: { type: String, required: true }, // support email if the order is pos
    full_name: { type: String, required: true }, // Walk in Customer - if the order is
    profile_picture: { type: String } // leave it blank if POS order
  },
  
  items: [
    {
      product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
      quantity: { type: Number, required: true },
      price: { type: Number, required: true },
      product_image: { type: String }
    }
  ],
  
  total: { type: Number, required: true },
  
  payment_method: { 
    type: String, 
    required: true, 
    enum: ['PAYPAL', 'CARD', 'WALLET_BALANCE', 'CASH', 'CREDIT', "FPS"] // Cash if the order is POS 
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
  paypal_payment_id: { type: String }, // PayPal payment ID
  paypal_payment_details: {
    payment_id: { type: String },
    payer_id: { type: String },
    state: { type: String },
    create_time: { type: String },
    update_time: { type: String },
    transactions: [{ type: mongoose.Schema.Types.Mixed }]
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
  
  // Notes and history
  admin_notes: [
    {
      note: { type: String },
      created_by: { type: String },
      created_at: { type: Date, default: Date.now }
    }
  ]
  
}, { timestamps: true });

// Indexes for better performance
OrderSchema.index({ order_code: 1 });
OrderSchema.index({ 'user.username': 1 });
OrderSchema.index({ 'user.email': 1 });
OrderSchema.index({ status: 1 });
OrderSchema.index({ payment_method: 1 });
OrderSchema.index({ paypal_payment_id: 1 });
OrderSchema.index({ createdAt: -1 });

// Middleware to update payment_completed_at when status changes to paid
OrderSchema.pre('save', function(next) {
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
OrderSchema.virtual('orderAge').get(function() {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24)); // in days
});

// Virtual for payment status
OrderSchema.virtual('isPaid').get(function() {
  return ['paid', 'processing', 'shipped', 'delivered', 'refunded'].includes(this.status);
});

// Virtual for can be cancelled
OrderSchema.virtual('canBeCancelled').get(function() {
  return ['pending', 'pending_payment', 'paid'].includes(this.status);
});

// Virtual for can be refunded
OrderSchema.virtual('canBeRefunded').get(function() {
  return ['paid', 'processing', 'shipped'].includes(this.status);
});

// Method to add admin note
OrderSchema.methods.addAdminNote = function(note, adminUsername) {
  this.admin_notes.push({
    note,
    created_by: adminUsername,
    created_at: new Date()
  });
  return this.save();
};

// Method to get status history (if you want to track status changes)
OrderSchema.methods.getStatusHistory = function() {
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
OrderSchema.methods.isPayPalPayment = function() {
  return this.payment_method === 'PAYPAL';
};

// Ensure virtual fields are serialized
OrderSchema.set('toJSON', { virtuals: true });
OrderSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Order', OrderSchema);