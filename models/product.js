const mongoose = require('mongoose');
const vendorScopePlugin = require("../plugin/vendorScopePlugin");
const ProductSchema = new mongoose.Schema({
  // Identification
  product_sku: { type: String, required: true, unique: true, trim: true },
  product_code: { type: String, required: true, unique: true, trim: true },
  product_name: { type: String, required: true },
  category_code: { type: String, required: true },

  // Pricing & stock
  product_cost_price: { type: String, default: "", required: false },
  price: { type: Number, default: 0, required: false },
  comparePrice: { type: Number, default: 0, required: false },
  discountPercentage: { type: Number, default: 0, required: false },
  stock: { type: Number, default: 0, required: false },
  stockStatus: { type: String, default: "", required: false },
  trackInventory: { type: Boolean, default: false, required: false },
  lowStockThreshold: { type: Number, default: 0, required: false },
  allowBackorder: { type: Boolean, default: false, required: false },
  outOfStockBehavior: { type: String, default: "", required: false },
  vendor_code: { type: String, required: true, index: true },
  // Images
  productImages: { type: [String], default: [], required: false },
  image: { type: String, default: "", required: false },
  blurhash: { type: String, default: "", required: false },

  // Descriptions
  short_description: { type: String, default: "", required: false },
  long_description: { type: String, default: "", required: false },
  description: { type: String, default: "", required: false },

  // Flags
  is_featured: { type: Boolean, default: false, required: false },
  isNewArrival: { type: Boolean, default: false, required: false },
  isBestSeller: { type: Boolean, default: false, required: false },
  isLimitedEdition: { type: Boolean, default: false, required: false },
  isSeasonal: { type: Boolean, default: false, required: false },

  // Product meta
  product_type: { 
    type: String, 
    enum: ['COFFEE_BEANS', 'BREWERS', 'GRINDERS', 'ACCESSORIES', 'MERCHANDISE', 'GIFT_SETS'], 
    default: "", 
    required: false 
  },
  vendorId: { type: String, default: "", required: false },
  slug: { type: String, default: "", required: false },
  sku: { type: String, default: "", required: false },

  // Analytics
  reward_points: { type: Number, default: 0, required: false },
  ratings: { type: Number, default: 0, required: false },
  salesCount: { type: Number, default: 0, required: false },
  viewCount: { type: Number, default: 0, required: false },
  likesCount: { type: Number, default: 0, required: false },
  averageRating: { type: Number, default: 0, required: false },
  totalReviews: { type: Number, default: 0, required: false },

  // Dates
  preorderDate: { type: Date, default: null, required: false },
  availableFrom: { type: Date, default: null, required: false },
  availableUntil: { type: Date, default: null, required: false },
  launchDate: { type: Date, default: null, required: false },
  discontinueDate: { type: Date, default: null, required: false },
  lastRestockedAt: { type: Date, default: null, required: false },

  // Shipping
  shipment_code: { type: String, default: "", required: false },

  // Tags
  tags: { type: [String], default: [], required: false },

  // Features (dynamic attributes)
  features: [
    {
      feature_name: { type: String, default: "", required: false },
      feature_value: { type: String, default: "", required: false }
    }
  ],

  // Variants (options)
  variants: [
    {
      variant_name: { 
        type: String, 
        enum: ['COLOR', 'SIZE', 'MATERIAL', 'REGION', 'FLAVOURS'], 
        default: "", 
        required: false 
      },
      variant_value: { type: String, default: "", required: false }
    }
  ],

}, { timestamps: true });

// Unique indexes
ProductSchema.index({ product_sku: 1 }, { unique: true });
ProductSchema.index({ product_code: 1 }, { unique: true });
ProductSchema.plugin(vendorScopePlugin);
module.exports = mongoose.model('Product', ProductSchema);