const mongoose = require('mongoose');

const GuestCartSchema = new mongoose.Schema({
  cart_code: { type: String, required: true, unique: true, trim: true },
  session_id: { type: String, required: true }, // Track guest sessions
  
  products: [
    {
      product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
      quantity: { type: Number, required: true, min: 1 },
      price: { type: Number, required: true }, // Original price
      finalPrice: { type: Number }, // Price after discounts
      discountAmount: { type: Number, default: 0 },
      discountApplied: { type: Boolean, default: false },
      product_image: { type: String },
      product_name: { type: String } // Store product name for reference
    }
  ],
  
  // Additional charges/discounts (shipping, taxes, etc.)
  subtotal: [
    {
      name: { type: String, required: true }, // e.g., "Shipping", "Tax", "Discount"
      value: { type: Number, required: true }, // Positive for charges, negative for discounts
      type: { type: String, enum: ['charge', 'discount'], required: true }
    }
  ],
  
  total: { type: Number, default: 0 },
  
  // Discount information
  discountInfo: {
    totalOriginalAmount: { type: Number, default: 0 },
    totalFinalAmount: { type: Number, default: 0 },
    totalDiscountAmount: { type: Number, default: 0 },
    hasDiscounts: { type: Boolean, default: false },
    discountsApplied: [{ type: mongoose.Schema.Types.Mixed }]
  },
  
  // Cart expires after certain time for cleanup
  expiresAt: { 
    type: Date, 
    default: Date.now, 
    expires: 604800 // 7 days in seconds
  }
  
}, { timestamps: true });

// Indexes for better performance
GuestCartSchema.index({ cart_code: 1 });
GuestCartSchema.index({ session_id: 1 });
GuestCartSchema.index({ expiresAt: 1 });

// Virtual for cart item count
GuestCartSchema.virtual('itemCount').get(function() {
  return this.products.reduce((total, product) => total + product.quantity, 0);
});

// Virtual for subtotal (before additional charges/discounts)
GuestCartSchema.virtual('productsSubtotal').get(function() {
  return this.products.reduce((total, product) => {
    const price = product.finalPrice || product.price || 0;
    return total + (price * product.quantity);
  }, 0);
});

// Method to add product to cart
GuestCartSchema.methods.addProduct = function(productData) {
  const existingProduct = this.products.find(p => 
    p.product_id.toString() === productData.product_id.toString()
  );

  if (existingProduct) {
    existingProduct.quantity += productData.quantity;
  } else {
    this.products.push(productData);
  }

  this.calculateTotal();
  return this.save();
};

// Method to remove product from cart
GuestCartSchema.methods.removeProduct = function(productId) {
  this.products = this.products.filter(p => 
    p.product_id.toString() !== productId.toString()
  );
  
  this.calculateTotal();
  return this.save();
};

// Method to update product quantity
GuestCartSchema.methods.updateProductQuantity = function(productId, quantity) {
  const product = this.products.find(p => 
    p.product_id.toString() === productId.toString()
  );

  if (product) {
    if (quantity <= 0) {
      return this.removeProduct(productId);
    } else {
      product.quantity = quantity;
      this.calculateTotal();
      return this.save();
    }
  }
  
  throw new Error('Product not found in cart');
};

// Method to calculate total
GuestCartSchema.methods.calculateTotal = function() {
  // Calculate products subtotal
  const productsSubtotal = this.products.reduce((total, product) => {
    const price = product.finalPrice || product.price || 0;
    return total + (price * product.quantity);
  }, 0);

  // Add additional charges/discounts
  const additionalCharges = this.subtotal.reduce((total, item) => {
    return total + item.value;
  }, 0);

  this.total = Math.max(0, productsSubtotal + additionalCharges);
  
  // Update discount info
  this.discountInfo.totalOriginalAmount = this.products.reduce((total, product) => {
    return total + ((product.price || 0) * product.quantity);
  }, 0);
  
  this.discountInfo.totalFinalAmount = productsSubtotal;
  this.discountInfo.totalDiscountAmount = this.discountInfo.totalOriginalAmount - this.discountInfo.totalFinalAmount;
  this.discountInfo.hasDiscounts = this.discountInfo.totalDiscountAmount > 0;
};

// Method to clear cart
GuestCartSchema.methods.clearCart = function() {
  this.products = [];
  this.subtotal = [];
  this.total = 0;
  this.discountInfo = {
    totalOriginalAmount: 0,
    totalFinalAmount: 0,
    totalDiscountAmount: 0,
    hasDiscounts: false,
    discountsApplied: []
  };
  return this.save();
};

// Method to extend expiration
GuestCartSchema.methods.extendExpiration = function(days = 7) {
  this.expiresAt = new Date(Date.now() + (days * 24 * 60 * 60 * 1000));
  return this.save();
};

// Pre-save middleware to calculate total
GuestCartSchema.pre('save', function(next) {
  if (this.isModified('products') || this.isModified('subtotal')) {
    this.calculateTotal();
  }
  next();
});

// Ensure virtual fields are serialized
GuestCartSchema.set('toJSON', { virtuals: true });
GuestCartSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('GuestCart', GuestCartSchema);