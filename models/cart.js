const mongoose = require('mongoose');

const CartSchema = new mongoose.Schema({
  cart_code: { type: String, required: true, unique: true, trim: true }, // can be POS_TERMINAL_ID in case the order is for POS
  username: { type: String, required: true }, // can be cashiers name in case the order is for POS
  products: [
    {
      product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
      product_name: {type:String},
      quantity: { type: Number, required: true, default: 1 },
      price: { type: Number, required: true }, // Original price
      finalPrice: { type: Number }, // Price after discount
      discountAmount: { type: Number, default: 0 }, // Discount amount per unit
      discountApplied: { type: Boolean, default: false }, // Whether discount is applied
      appliedDiscount: {
        id: { type: mongoose.Schema.Types.ObjectId, ref: 'Discount' },
        type: { type: String, enum: ['product', 'campaign'] },
        method: { type: String, enum: ['fixed', 'percentage'] },
        value: { type: Number },
        cap: { type: Number }
      },
      product_image: { type: String }  // One product image URL
    }
  ],
  subtotal: [
    {
      name: { type: String, required: true },  // e.g., GST, Sales Tax, Discount, Voucher, Delivery Charges etc etc 
      value: { type: Number, required: true }  // Can be negative for deductions
    }
  ],
  total: { type: Number, required: true },
  discountInfo: {
    totalOriginalAmount: { type: Number, default: 0 }, // Total before any discounts
    totalFinalAmount: { type: Number, default: 0 }, // Total after discounts
    totalDiscountAmount: { type: Number, default: 0 }, // Total discount amount
    hasDiscounts: { type: Boolean, default: false }, // Whether any discounts are applied
    discountsApplied: [{
      productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
      discount: {
        id: { type: mongoose.Schema.Types.ObjectId, ref: 'Discount' },
        type: { type: String, enum: ['product', 'campaign'] },
        method: { type: String, enum: ['fixed', 'percentage'] },
        value: { type: Number },
        cap: { type: Number }
      },
      originalPrice: { type: Number },
      discountedPrice: { type: Number },
      discountAmount: { type: Number },
      quantity: { type: Number },
      totalDiscountAmount: { type: Number }
    }]
  }
}, { timestamps: true });

// Index for better performance
CartSchema.index({ cart_code: 1 });
CartSchema.index({ username: 1 });

// Middleware to ensure finalPrice is set if not provided
CartSchema.pre('save', function(next) {
  this.products.forEach(product => {
    if (!product.finalPrice) {
      product.finalPrice = product.price;
    }
    if (product.discountAmount === undefined) {
      product.discountAmount = 0;
    }
    if (product.discountApplied === undefined) {
      product.discountApplied = false;
    }
  });
  
  // Initialize discountInfo if not present
  if (!this.discountInfo) {
    this.discountInfo = {
      totalOriginalAmount: 0,
      totalFinalAmount: 0,
      totalDiscountAmount: 0,
      hasDiscounts: false,
      discountsApplied: []
    };
  }
  
  next();
});

// Virtual for calculating savings percentage
CartSchema.virtual('savingsPercentage').get(function() {
  if (!this.discountInfo || this.discountInfo.totalOriginalAmount === 0) {
    return 0;
  }
  return ((this.discountInfo.totalDiscountAmount / this.discountInfo.totalOriginalAmount) * 100).toFixed(2);
});

// Method to get cart summary
CartSchema.methods.getSummary = function() {
  return {
    cartCode: this.cart_code,
    username: this.username,
    itemCount: this.products.length,
    totalQuantity: this.products.reduce((acc, p) => acc + p.quantity, 0),
    originalTotal: this.discountInfo.totalOriginalAmount,
    finalTotal: this.total,
    totalSavings: this.discountInfo.totalDiscountAmount,
    savingsPercentage: this.savingsPercentage,
    hasDiscounts: this.discountInfo.hasDiscounts
  };
};

// Method to check if cart has any discounted items
CartSchema.methods.hasDiscountedItems = function() {
  return this.products.some(product => product.discountApplied);
};

// Method to get all discounted products
CartSchema.methods.getDiscountedProducts = function() {
  return this.products.filter(product => product.discountApplied);
};

// Ensure virtual fields are serialized
CartSchema.set('toJSON', { virtuals: true });
CartSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Cart', CartSchema);