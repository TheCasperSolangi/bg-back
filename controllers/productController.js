const Product = require('../models/product');
const asyncHandler = require('../utils/asyncHandler');
const { applyBestDiscount, getActiveProductDiscounts } = require('../utils/discountHelper');
const Order = require('../models/order');

// @desc    Create new product
// @route   POST /api/products
// @access  Private/Admin
// Create Product (Prevent Duplication)
exports.createProduct = asyncHandler(async (req, res) => {
  const { product_sku, product_code } = req.body;

  // Check if product with same SKU or product_code exists
  const existingProduct = await Product.findOne({
    $or: [
      { product_sku },
      { product_code }
    ]
  });

  if (existingProduct) {
    return res.status(400).json({ 
      success: false,
      message: 'Product with same SKU or Product Code already exists'
    });
  }

  const product = await Product.create(req.body);
  res.status(201).json({ success: true, data: product });
});

// @desc    Get all products with discount information
// @route   GET /api/products
// @access  Public
exports.getProducts = asyncHandler(async (req, res) => {
  const { include_discounts } = req.query;
  
  const products = await Product.find();
  
  if (include_discounts === 'true') {
    // Apply discount information to all products
    const productsWithDiscounts = await Promise.all(
      products.map(async (product) => {
        const discountResult = await applyBestDiscount(product._id, product.price);
        
        return {
          ...product.toObject(),
          pricing: {
            originalPrice: product.price,
            currentPrice: discountResult.finalPrice,
            discountAmount: discountResult.discountAmount,
            discountApplied: discountResult.discountApplied,
            appliedDiscount: discountResult.appliedDiscount
          }
        };
      })
    );
    
    return res.json({ 
      success: true, 
      count: productsWithDiscounts.length, 
      data: productsWithDiscounts 
    });
  }
  
  res.json({ success: true, count: products.length, data: products });
});

// @desc    Get product by ID with discount information
// @route   GET /api/products/:id
// @access  Public
exports.getProductById = asyncHandler(async (req, res) => {
  const { include_discounts } = req.query;
  
  const product = await Product.findById(req.params.id);
  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  let responseData = product.toObject();

  if (include_discounts === 'true') {
    const discountResult = await applyBestDiscount(product._id, product.price);

    // Only attach discount if applied
    if (discountResult.discountApplied) {
      const activeDiscounts = await getActiveProductDiscounts(product._id);
      responseData = {
        ...responseData,
        pricing: {
          originalPrice: product.price,
          currentPrice: discountResult.finalPrice,
          discountAmount: discountResult.discountAmount,
          discountApplied: discountResult.discountApplied,
          appliedDiscount: discountResult.appliedDiscount
        },
        availableDiscounts: {
          productSpecific: activeDiscounts.productDiscounts,
          campaigns: activeDiscounts.campaignDiscounts,
          total: activeDiscounts.allDiscounts.length
        }
      };
    }
  }

  res.json({ success: true, data: responseData });
});


// @desc    Get product by product_code; include discount info only if applied
// @route   GET /api/products/code/:product_code
// @access  Public
exports.getProductByProductCode = asyncHandler(async (req, res) => {
  const { product_code } = req.params;

  const product = await Product.findOne({ product_code });
  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  let responseData = product.toObject();

  // Always check discount; attach only if applied
  const discountResult = await applyBestDiscount(product._id, product.price);
  if (discountResult?.discountApplied) {
    const activeDiscounts = await getActiveProductDiscounts(product._id);

    responseData = {
      ...responseData,
      pricing: {
        originalPrice: product.price,
        currentPrice: discountResult.finalPrice,
        discountAmount: discountResult.discountAmount,
        discountPercentage: ((discountResult.discountAmount / product.price) * 100).toFixed(2),
        appliedDiscount: discountResult.appliedDiscount
      },
      availableDiscounts: {
        productSpecific: activeDiscounts.productDiscounts,
        campaigns: activeDiscounts.campaignDiscounts,
        total: activeDiscounts.allDiscounts.length
      }
    };
  }

  res.json({ success: true, data: responseData });
});

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private/Admin
exports.updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }
  res.json({ success: true, data: product });
});

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private/Admin
exports.deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }
  res.json({ success: true, message: 'Product deleted successfully' });
});

// @desc    Get products by category with discount information
// @route   GET /api/products/category/:category_code
// @access  Public
exports.getProductsByCategory = asyncHandler(async (req, res) => {
  const { category_code } = req.params;
  const { include_discounts } = req.query;

  const products = await Product.find({ category_code });

  if (!products || products.length === 0) {
    return res.status(404).json({ success: false, message: 'No products found in this category' });
  }

  if (include_discounts === 'true') {
    // Apply discount information to all products in category
    const productsWithDiscounts = await Promise.all(
      products.map(async (product) => {
        const discountResult = await applyBestDiscount(product._id, product.price);
        
        return {
          ...product.toObject(),
          pricing: {
            originalPrice: product.price,
            currentPrice: discountResult.finalPrice,
            discountAmount: discountResult.discountAmount,
            discountApplied: discountResult.discountApplied,
            appliedDiscount: discountResult.appliedDiscount
          }
        };
      })
    );
    
    return res.json({ 
      success: true, 
      count: productsWithDiscounts.length, 
      data: productsWithDiscounts 
    });
  }

  res.json({ success: true, count: products.length, data: products });
});

// @desc    Get featured products with discount information
// @route   GET /api/products/featured
// @access  Public
exports.getFeaturedProducts = asyncHandler(async (req, res) => {
  const { include_discounts } = req.query;
  
  // Assuming you have a Boolean field called 'is_featured' in your product schema
  const products = await Product.find({ is_featured: true });

  if (!products || products.length === 0) {
    return res.status(404).json({ success: false, message: 'No featured products found' });
  }

  if (include_discounts === 'true') {
    // Apply discount information to featured products
    const productsWithDiscounts = await Promise.all(
      products.map(async (product) => {
        const discountResult = await applyBestDiscount(product._id, product.price);
        
        return {
          ...product.toObject(),
          pricing: {
            originalPrice: product.price,
            currentPrice: discountResult.finalPrice,
            discountAmount: discountResult.discountAmount,
            discountApplied: discountResult.discountApplied,
            appliedDiscount: discountResult.appliedDiscount
          }
        };
      })
    );
    
    return res.json({ 
      success: true, 
      count: productsWithDiscounts.length, 
      data: productsWithDiscounts 
    });
  }

  res.json({ success: true, count: products.length, data: products });
});

// @desc    Get products on discount
// @route   GET /api/products/on-discount
// @access  Public
exports.getProductsOnDiscount = asyncHandler(async (req, res) => {
  const { discount_type } = req.query; // 'product', 'campaign', or 'all'
  
  const products = await Product.find();
  const productsOnDiscount = [];

  for (const product of products) {
    const discountResult = await applyBestDiscount(product._id, product.price);
    
    if (discountResult.discountApplied) {
      // Filter by discount type if specified
      const shouldInclude = !discount_type || 
        discount_type === 'all' || 
        discountResult.appliedDiscount.type === discount_type;
        
      if (shouldInclude) {
        productsOnDiscount.push({
          ...product.toObject(),
          pricing: {
            originalPrice: product.price,
            currentPrice: discountResult.finalPrice,
            discountAmount: discountResult.discountAmount,
            discountPercentage: ((discountResult.discountAmount / product.price) * 100).toFixed(2),
            appliedDiscount: discountResult.appliedDiscount
          }
        });
      }
    }
  }

  res.json({ 
    success: true, 
    count: productsOnDiscount.length, 
    data: productsOnDiscount 
  });
});

// @desc    Get product pricing with discount details
// @route   GET /api/products/:id/pricing
// @access  Public
exports.getProductPricing = asyncHandler(async (req, res) => {
  const { quantity = 1 } = req.query;
  
  const product = await Product.findById(req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  const discountResult = await applyBestDiscount(product._id, product.price, parseInt(quantity));
  const activeDiscounts = await getActiveProductDiscounts(product._id);

  res.json({
    success: true,
    data: {
      productId: product._id,
      productName: product.product_name,
      quantity: parseInt(quantity),
      pricing: {
        originalPricePerUnit: product.price,
        finalPricePerUnit: discountResult.finalPrice,
        discountAmountPerUnit: discountResult.discountAmount,
        totalOriginalPrice: discountResult.totalOriginal,
        totalFinalPrice: discountResult.totalFinal,
        totalDiscountAmount: discountResult.totalDiscountAmount,
        discountApplied: discountResult.discountApplied
      },
      appliedDiscount: discountResult.appliedDiscount,
      availableDiscounts: activeDiscounts.allDiscounts,
      savingsPercentage: discountResult.discountApplied ? 
        ((discountResult.discountAmount / product.price) * 100).toFixed(2) : 0
    }
  });
});

// @desc    Get related products by product ID (based on category + price + featured)
// @route   GET /api/products/:id/related
// @access  Public

const stringSimilarity = require('string-similarity'); // npm install string-similarity

// @access Public
exports.getRelatedProducts = asyncHandler(async (req, res) => {
  const { include_discounts, limit = 5 } = req.query;

  const product = await Product.findById(req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  const minPrice = product.price * 0.8;
  const maxPrice = product.price * 1.2;

  // Step 1: Fetch candidates (any product except current)
  let candidates = await Product.find({ _id: { $ne: product._id } });

  if (!candidates || candidates.length === 0) {
    return res.status(404).json({ success: false, message: 'No related products found' });
  }

  // Step 2: Score candidates
  const scoredProducts = candidates.map((p) => {
    let score = 0;

    // Price similarity ±20%
    const priceDiff = Math.abs(p.price - product.price) / product.price;
    score += (1 - Math.min(priceDiff, 1)) * 20;

    // Flags
    if (p.is_featured) score += 15;
    if (p.isBestSeller) score += 15;
    if (p.isNewArrival) score += 10;

    // Ratings & engagement
    score += Math.min(p.averageRating || 0, 5) * 4;
    score += Math.min(p.totalReviews || 0, 50) / 50 * 10;
    score += Math.min(p.viewCount || 0, 1000) / 1000 * 10;
    score += Math.min(p.likesCount || 0, 100) / 100 * 5;

    // Tags overlap
    const sharedTags = p.tags.filter((tag) => product.tags.includes(tag));
    if (sharedTags.length) score += Math.min(sharedTags.length / product.tags.length, 1) * 10;

    // Fuzzy title similarity
    const titleSimilarity = stringSimilarity.compareTwoStrings(
      product.product_name.toLowerCase(),
      p.product_name.toLowerCase()
    ); // returns 0..1
    score += titleSimilarity * 25; // max 25 points for title similarity

    return { product: p, score, titleSimilarity };
  });

  // Step 3: Filter products with score >= 50 OR titleSimilarity >= 0.25
  let relatedProducts = scoredProducts
    .filter((p) => p.score >= 50 || p.titleSimilarity >= 0.25)
    .sort((a, b) => b.score - a.score)
    .map((p) => p.product);

  // Step 4: Ensure at least 1 product
  if (relatedProducts.length === 0 && scoredProducts.length > 0) {
    relatedProducts = [scoredProducts[0].product];
  }

  // Step 5: Limit results
  relatedProducts = relatedProducts.slice(0, parseInt(limit));

  // Step 6: Apply discounts if requested
  if (include_discounts === 'true') {
    relatedProducts = await Promise.all(
      relatedProducts.map(async (related) => {
        const discountResult = await applyBestDiscount(related._id, related.price);
        return {
          ...related.toObject(),
          pricing: {
            originalPrice: related.price,
            currentPrice: discountResult.finalPrice,
            discountAmount: discountResult.discountAmount,
            discountApplied: discountResult.discountApplied,
            appliedDiscount: discountResult.appliedDiscount
          }
        };
      })
    );
  }

  res.json({ success: true, count: relatedProducts.length, data: relatedProducts });
});



// @desc    Get best-selling products (last 7 days)
// @route   GET /api/products/best-sellers
// @access  Public
exports.getBestSellers = asyncHandler(async (req, res) => {
  const { include_discounts, limit = 10 } = req.query;

  // Get date 7 days ago
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Aggregate sales from last 7 days
  const bestSellingProducts = await Order.aggregate([
    {
      $match: { createdAt: { $gte: sevenDaysAgo } }
    },
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.product_id",
        totalQuantity: { $sum: "$items.quantity" },
        totalRevenue: { $sum: { $multiply: ["$items.quantity", "$items.price"] } },
        totalOrders: { $sum: 1 }
      }
    },
    { $sort: { totalQuantity: -1 } },
    { $limit: parseInt(limit) }
  ]);

  if (!bestSellingProducts.length) {
    return res.status(404).json({
      success: false,
      message: "No sales data found for last 7 days"
    });
  }

  // Fetch product details
  const productIds = bestSellingProducts.map(p => p._id);
  let products = await Product.find({ _id: { $in: productIds } });

  // Attach sales metrics
  products = products.map(product => {
    const salesData = bestSellingProducts.find(p => p._id.toString() === product._id.toString());
    return {
      ...product.toObject(),
      metrics: {
        totalQuantitySold: salesData.totalQuantity,
        totalRevenue: salesData.totalRevenue,
        totalOrders: salesData.totalOrders
      }
    };
  });

  // Apply discounts if requested
  if (include_discounts === 'true') {
    products = await Promise.all(
      products.map(async (product) => {
        const discountResult = await applyBestDiscount(product._id, product.price);

        return {
          ...product,
          pricing: {
            originalPrice: product.price,
            currentPrice: discountResult.finalPrice,
            discountAmount: discountResult.discountAmount,
            discountApplied: discountResult.discountApplied,
            appliedDiscount: discountResult.appliedDiscount
          }
        };
      })
    );
  }

  res.json({
    success: true,
    count: products.length,
    data: products
  });
});

// @desc    Search products by multi-word query
// @route   GET /api/products/search
// @access  Public
exports.searchProduct = asyncHandler(async (req, res) => {
  let { query = "", include_discounts } = req.query;

  if (!query || query.trim() === "") {
    return res.status(400).json({ success: false, message: "Query cannot be empty" });
  }

  // Split query into words and filter out empty strings
  const words = query.trim().split(/\s+/);

  // Build regex filters for each word
  const orFilters = words.map(word => {
    const regex = new RegExp(word, "i"); // case-insensitive
    return {
      $or: [
        { product_name: regex },
        { product_code: regex },
        { product_sku: regex }
      ]
    };
  });

  // Find products matching any word
  const products = await Product.find({ $and: orFilters }); // $and ensures all words are considered

  if (!products || products.length === 0) {
    return res.status(404).json({ success: false, message: "No products found matching the query" });
  }

  // Apply discounts if requested
  let responseProducts = products;
  if (include_discounts === "true") {
    responseProducts = await Promise.all(
      products.map(async (product) => {
        const discountResult = await applyBestDiscount(product._id, product.price);
        return {
          ...product.toObject(),
          pricing: {
            originalPrice: product.price,
            currentPrice: discountResult.finalPrice,
            discountAmount: discountResult.discountAmount,
            discountApplied: discountResult.discountApplied,
            appliedDiscount: discountResult.appliedDiscount
          }
        };
      })
    );
  }

  res.json({ success: true, count: responseProducts.length, data: responseProducts });
});
// @desc    Get new arrival products (sorted by newest first)
// @route   GET /api/products/new-arrivals
// @access  Public
exports.getNewArrivals = asyncHandler(async (req, res) => {
  const { include_discounts, limit = 10 } = req.query;

  // Fetch newest products
  let products = await Product.find()
    .sort({ createdAt: -1 }) // newest first
    .limit(parseInt(limit));

  if (!products || products.length === 0) {
    return res.status(404).json({ success: false, message: 'No new arrival products found' });
  }

  // Apply discounts if requested
  if (include_discounts === 'true') {
    products = await Promise.all(
      products.map(async (product) => {
        const discountResult = await applyBestDiscount(product._id, product.price);
        return {
          ...product.toObject(),
          pricing: {
            originalPrice: product.price,
            currentPrice: discountResult.finalPrice,
            discountAmount: discountResult.discountAmount,
            discountApplied: discountResult.discountApplied,
            appliedDiscount: discountResult.appliedDiscount
          }
        };
      })
    );
  }

  res.json({
    success: true,
    count: products.length,
    data: products
  });
});