const GuestCart = require('../models/guestCart');
const Product = require('../models/product');
const asyncHandler = require('../utils/asyncHandler');
const { customAlphabet } = require('nanoid');
const { applyVoucherToCart, removeVoucherFromCart } = require('../utils/voucherHelper');
const { applyDiscountsToCart, applyBestDiscount } = require('../utils/discountHelper');
const { default: mongoose } = require('mongoose');

// Helper function to safely round to 2 decimal places
const roundToTwo = (num) => {
  return Math.round((num + Number.EPSILON) * 100) / 100;
};

// Helper function to calculate products total (with discounts) - FIXED
const calculateProductsTotal = (products) => {
  if (!products || !Array.isArray(products)) {
    return 0;
  }
  
  const total = products.reduce((acc, p) => {
    if (!p || typeof p !== 'object') {
      return acc;
    }
    
    const finalPrice = parseFloat(p.finalPrice) || parseFloat(p.price) || 0;
    const quantity = parseInt(p.quantity) || 0;
    const productTotal = finalPrice * quantity;
    
    // Ensure we don't add NaN to our accumulator
    if (isNaN(productTotal)) {
      console.warn(`Invalid product total for product ${p.product_id}: finalPrice=${finalPrice}, quantity=${quantity}`);
      return acc;
    }
    
    return acc + productTotal;
  }, 0);
  
  return roundToTwo(total);
};

// Alternative simpler approach - just use discountInfo totals
const recalculateGuestCartTotal = async (guestCart) => {
  if (!guestCart) {
    throw new Error('Guest cart is required');
  }
  
  try {
    // Apply discounts to cart first
    const cartWithDiscounts = await applyDiscountsToCart(guestCart);
    
    // The applyDiscountsToCart function already calculates the correct totals
    // Round to 2 decimal places to avoid floating point precision issues
    const productsTotal = roundToTwo(cartWithDiscounts.discountInfo?.totalFinalAmount || 0);
    
    // Safely calculate subtotal adjustments while preserving type field
    const subtotalAdjustments = (cartWithDiscounts.subtotal || []).reduce((acc, item) => {
      if (!item || typeof item !== 'object') {
        return acc;
      }
      
      const value = parseFloat(item.value) || 0;
      if (isNaN(value)) {
        console.warn(`Invalid subtotal item value: ${item.value} for ${item.name}`);
        return acc;
      }
      
      return acc + value;
    }, 0);
    
    const roundedSubtotalAdjustments = roundToTwo(subtotalAdjustments);
    
    // Update cart with processed data
    guestCart.products = cartWithDiscounts.products || [];
    
    // Preserve subtotal items with their type field, or ensure they have a default type
    guestCart.subtotal = (cartWithDiscounts.subtotal || []).map(item => ({
      ...item,
      type: item.type || 'charge' // Ensure type field exists with default value
    }));
    
    // Round discountInfo values as well
    if (cartWithDiscounts.discountInfo) {
      cartWithDiscounts.discountInfo.totalOriginalAmount = roundToTwo(cartWithDiscounts.discountInfo.totalOriginalAmount || 0);
      cartWithDiscounts.discountInfo.totalFinalAmount = roundToTwo(cartWithDiscounts.discountInfo.totalFinalAmount || 0);
      cartWithDiscounts.discountInfo.totalDiscountAmount = roundToTwo(cartWithDiscounts.discountInfo.totalDiscountAmount || 0);
    }
    
    guestCart.discountInfo = cartWithDiscounts.discountInfo || {
      totalOriginalAmount: 0,
      totalFinalAmount: 0,
      totalDiscountAmount: 0,
      hasDiscounts: false,
      discountsApplied: []
    };
    
    // Calculate final total and round
    const finalTotal = productsTotal + roundedSubtotalAdjustments;
    guestCart.total = isNaN(finalTotal) ? 0 : roundToTwo(Math.max(0, finalTotal));
    
    // Debug logging
    console.log('Guest cart calculation debug:', {
      productsTotal,
      subtotalAdjustments: roundedSubtotalAdjustments,
      finalTotal,
      cartTotal: guestCart.total,
      discountInfoFinalAmount: guestCart.discountInfo.totalFinalAmount
    });
    
    return guestCart;
  } catch (error) {
    console.error('Error in recalculateGuestCartTotal:', error);
    throw error;
  }
};

// @desc Get guest cart by session ID
// @route GET /api/guest-carts/session/:session_id
// @access Public
exports.getGuestCartBySession = asyncHandler(async (req, res) => {
  const { session_id } = req.params;
  const { include_discounts = 'true' } = req.query;

  if (!session_id) {
    return res.status(400).json({ 
      success: false, 
      message: 'Session ID is required' 
    });
  }

  let guestCart = await GuestCart.findOne({ session_id })
    .populate('products.product_id')
    .sort({ updatedAt: -1 })
    .limit(1);

  if (!guestCart) {
    return res.status(404).json({ 
      success: false, 
      message: 'No guest cart found for this session' 
    });
  }

  // Apply current discounts if requested
  if (include_discounts === 'true' && guestCart.products && guestCart.products.length > 0) {
    guestCart = await recalculateGuestCartTotal(guestCart);
    await guestCart.save();
  }

  res.json({ 
    success: true, 
    data: guestCart 
  });
});

// @desc Get guest cart by cart code
// @route GET /api/guest-carts/:cart_code
// @access Public
exports.getGuestCartByCode = asyncHandler(async (req, res) => {
  const { cart_code } = req.params;
  const { session_id, include_discounts = 'true' } = req.query;

  if (!cart_code) {
    return res.status(400).json({ 
      success: false, 
      message: 'Cart code is required' 
    });
  }

  if (!session_id) {
    return res.status(400).json({ 
      success: false, 
      message: 'Session ID is required' 
    });
  }

  let guestCart = await GuestCart.findOne({ 
    cart_code, 
    session_id 
  }).populate('products.product_id');

  if (!guestCart) {
    return res.status(404).json({ 
      success: false, 
      message: 'Guest cart not found' 
    });
  }

  // Apply current discounts if requested
  if (include_discounts === 'true' && guestCart.products && guestCart.products.length > 0) {
    guestCart = await recalculateGuestCartTotal(guestCart);
    await guestCart.save();
  }

  res.json({ 
    success: true, 
    data: guestCart 
  });
});

// @desc Create new guest cart or return existing
// @route POST /api/guest-carts
// @access Public
exports.createOrGetGuestCart = asyncHandler(async (req, res) => {
  const { session_id } = req.body;

  if (!session_id) {
    return res.status(400).json({ 
      success: false, 
      message: 'Session ID is required' 
    });
  }

  // Check if a cart already exists for this session
  let guestCart = await GuestCart.findOne({ session_id });

  if (!guestCart) {
    // Generate unique cart code
    const nanoid = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 10);
    const cart_code = nanoid();

    guestCart = await GuestCart.create({
      cart_code,
      session_id,
      products: [],
      subtotal: [], // Empty array, items will be added with proper type field later
      total: 0,
      discountInfo: {
        totalOriginalAmount: 0,
        totalFinalAmount: 0,
        totalDiscountAmount: 0,
        hasDiscounts: false,
        discountsApplied: []
      }
    });
  } else {
    // If cart exists, ensure all subtotal items have type field
    if (guestCart.subtotal && guestCart.subtotal.length > 0) {
      guestCart.subtotal = guestCart.subtotal.map(item => ({
        ...item,
        type: item.type || 'charge' // Ensure type field exists with default value
      }));
    }
  }

  // Apply discounts to existing cart if it has products
  if (guestCart.products && guestCart.products.length > 0) {
    guestCart = await recalculateGuestCartTotal(guestCart);
    await guestCart.save();
  }

  res.json({ 
    success: true, 
    data: guestCart 
  });
});

// @desc Add product to guest cart with automatic discount application - ENHANCED
// @route POST /api/guest-carts/:cart_code/add-product
// @access Public
exports.addProductToGuestCart = asyncHandler(async (req, res) => {
  const { cart_code } = req.params;
  let { session_id, product_id, quantity } = req.body;

  // Enhanced validation
  if (!session_id || !product_id || !quantity) {
    return res.status(400).json({
      success: false,
      message: 'Session ID, valid product_id or product_code, and quantity are required'
    });
  }

  const parsedQuantity = parseInt(quantity);
  if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Quantity must be a valid positive number'
    });
  }

  // Check if product_id is a valid ObjectId, otherwise treat as product_code
  let product;
  if (!mongoose.Types.ObjectId.isValid(product_id)) {
    // Assume product_id is actually a product_code
    product = await Product.findOne({ product_code: product_id });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found with given product_code' });
    }
    product_id = product._id.toString(); // replace product_id with actual _id
  } else {
    // Normal lookup by _id
    product = await Product.findById(product_id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found with given _id' });
    }
  }

  // Find guest cart
  const guestCart = await GuestCart.findOne({ 
    cart_code, 
    session_id 
  });

  if (!guestCart) {
    return res.status(404).json({ 
      success: false, 
      message: 'Guest cart not found' 
    });
  }

  // Ensure product price is valid
  const productPrice = parseFloat(product.price);
  if (isNaN(productPrice) || productPrice < 0) {
    return res.status(400).json({
      success: false,
      message: 'Product has invalid price'
    });
  }

  try {
    // Get current discount information for the product
    const discountResult = await applyBestDiscount(product_id, productPrice, parsedQuantity);

    // Validate discount result and round values
    if (!discountResult || isNaN(discountResult.finalPrice)) {
      console.warn('Invalid discount result:', discountResult);
      // Fallback to original price
      discountResult.finalPrice = productPrice;
      discountResult.discountAmount = 0;
      discountResult.discountApplied = false;
      discountResult.appliedDiscount = null;
    }

    // Check if product already in cart
    const existingProductIndex = guestCart.products.findIndex(p => p.product_id.toString() === product_id);

    if (existingProductIndex > -1) {
      // Update quantity and pricing information
      const newQuantity = guestCart.products[existingProductIndex].quantity + parsedQuantity;
      const updatedDiscountResult = await applyBestDiscount(product_id, productPrice, newQuantity);

      // Validate updated discount result
      if (!updatedDiscountResult || isNaN(updatedDiscountResult.finalPrice)) {
        updatedDiscountResult.finalPrice = productPrice;
        updatedDiscountResult.discountAmount = 0;
        updatedDiscountResult.discountApplied = false;
        updatedDiscountResult.appliedDiscount = null;
      }

      guestCart.products[existingProductIndex].quantity = newQuantity;
      guestCart.products[existingProductIndex].price = roundToTwo(productPrice);
      guestCart.products[existingProductIndex].finalPrice = roundToTwo(parseFloat(updatedDiscountResult.finalPrice) || productPrice);
      guestCart.products[existingProductIndex].discountAmount = roundToTwo(parseFloat(updatedDiscountResult.discountAmount) || 0);
      guestCart.products[existingProductIndex].discountApplied = Boolean(updatedDiscountResult.discountApplied);
      guestCart.products[existingProductIndex].appliedDiscount = updatedDiscountResult.appliedDiscount;
      guestCart.products[existingProductIndex].product_image = product.productImages && product.productImages.length > 0 ? product.productImages[0] : null;
      guestCart.products[existingProductIndex].product_name = product.product_name || 'Product';
    } else {
      guestCart.products.push({
        product_id,
        quantity: parsedQuantity,
        price: roundToTwo(productPrice),
        finalPrice: roundToTwo(parseFloat(discountResult.finalPrice) || productPrice),
        discountAmount: roundToTwo(parseFloat(discountResult.discountAmount) || 0),
        discountApplied: Boolean(discountResult.discountApplied),
        appliedDiscount: discountResult.appliedDiscount,
        product_image: product.productImages && product.productImages.length > 0 ? product.productImages[0] : null,
        product_name: product.product_name || 'Product'
      });
    }

    // Recalculate total with all discounts applied
    await recalculateGuestCartTotal(guestCart);

    // Final validation before saving
    if (isNaN(guestCart.total)) {
      console.error('Guest cart total is still NaN after recalculation');
      guestCart.total = 0; // Set to 0 as fallback
    }

    await guestCart.save();

    // Populate and return updated cart
    const updatedCart = await GuestCart.findById(guestCart._id)
      .populate('products.product_id');

    res.json({ 
      success: true, 
      data: updatedCart 
    });
  } catch (error) {
    console.error('Error adding product to guest cart:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding product to guest cart: ' + error.message
    });
  }
});

// @desc Update product quantity in guest cart - ENHANCED
// @route PUT /api/guest-carts/:cart_code/products/:product_id
// @access Public
exports.updateGuestCartProductQuantity = asyncHandler(async (req, res) => {
  const { cart_code, product_id } = req.params;
  const { session_id, quantity } = req.body;

  // Enhanced validation
  const parsedQuantity = parseInt(quantity);
  if (!session_id || isNaN(parsedQuantity) || parsedQuantity <= 0) {
    return res.status(400).json({ 
      success: false, 
      message: 'Session ID and valid positive quantity are required' 
    });
  }

  // Find guest cart
  const guestCart = await GuestCart.findOne({ 
    cart_code, 
    session_id 
  });

  if (!guestCart) {
    return res.status(404).json({ 
      success: false, 
      message: 'Guest cart not found' 
    });
  }

  const productIndex = guestCart.products.findIndex(p => p.product_id.toString() === product_id);
  if (productIndex === -1) {
    return res.status(404).json({ success: false, message: 'Product not found in guest cart' });
  }

  try {
    // Update quantity and recalculate discount for new quantity
    const product = guestCart.products[productIndex];
    const productPrice = parseFloat(product.price);
    
    if (isNaN(productPrice)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Product has invalid price in cart' 
      });
    }

    const discountResult = await applyBestDiscount(product_id, productPrice, parsedQuantity);
    
    // Validate discount result
    if (!discountResult || isNaN(discountResult.finalPrice)) {
      discountResult.finalPrice = productPrice;
      discountResult.discountAmount = 0;
      discountResult.discountApplied = false;
      discountResult.appliedDiscount = null;
    }

    guestCart.products[productIndex].quantity = parsedQuantity;
    guestCart.products[productIndex].finalPrice = roundToTwo(parseFloat(discountResult.finalPrice) || productPrice);
    guestCart.products[productIndex].discountAmount = roundToTwo(parseFloat(discountResult.discountAmount) || 0);
    guestCart.products[productIndex].discountApplied = Boolean(discountResult.discountApplied);
    guestCart.products[productIndex].appliedDiscount = discountResult.appliedDiscount;

    // Recalculate total with all discounts applied
    await recalculateGuestCartTotal(guestCart);
    
    // Final validation
    if (isNaN(guestCart.total)) {
      guestCart.total = 0;
    }
    
    await guestCart.save();
    
    // Populate and return updated cart
    const updatedCart = await GuestCart.findById(guestCart._id)
      .populate('products.product_id');

    res.json({ 
      success: true, 
      message: 'Product quantity updated',
      data: updatedCart 
    });
  } catch (error) {
    console.error('Error updating guest cart product quantity:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error updating quantity: ' + error.message 
    });
  }
});

// @desc Remove product from guest cart - ENHANCED
// @route DELETE /api/guest-carts/:cart_code/products/:product_id
// @access Public
exports.removeProductFromGuestCart = asyncHandler(async (req, res) => {
  const { cart_code, product_id } = req.params;
  const { session_id } = req.body;

  if (!session_id) {
    return res.status(400).json({ 
      success: false, 
      message: 'Session ID is required' 
    });
  }

  // Find guest cart
  const guestCart = await GuestCart.findOne({ 
    cart_code, 
    session_id 
  });

  if (!guestCart) {
    return res.status(404).json({ 
      success: false, 
      message: 'Guest cart not found' 
    });
  }

  guestCart.products = guestCart.products.filter(p => p.product_id.toString() !== product_id);

  // Recalculate total with remaining products and their discounts
  await recalculateGuestCartTotal(guestCart);
  await guestCart.save();

  // Populate and return updated cart
  const updatedCart = await GuestCart.findById(guestCart._id)
    .populate('products.product_id');

  res.json({ 
    success: true, 
    message: 'Product removed from guest cart',
    data: updatedCart 
  });
});

// @desc Clear guest cart - ENHANCED
// @route DELETE /api/guest-carts/:cart_code/clear
// @access Public
exports.clearGuestCart = asyncHandler(async (req, res) => {
  const { cart_code } = req.params;
  const { session_id } = req.body;

  if (!session_id) {
    return res.status(400).json({ 
      success: false, 
      message: 'Session ID is required' 
    });
  }

  // Find guest cart
  const guestCart = await GuestCart.findOne({ 
    cart_code, 
    session_id 
  });

  if (!guestCart) {
    return res.status(404).json({ 
      success: false, 
      message: 'Guest cart not found' 
    });
  }

  guestCart.products = [];
  guestCart.subtotal = [];
  guestCart.total = 0;
  guestCart.discountInfo = {
    totalOriginalAmount: 0,
    totalFinalAmount: 0,
    totalDiscountAmount: 0,
    hasDiscounts: false,
    discountsApplied: []
  };

  await guestCart.save();

  res.json({ 
    success: true, 
    message: 'Guest cart cleared successfully',
    data: guestCart 
  });
});

// @desc Add/update subtotal item (shipping, tax, discount, etc.) - ENHANCED
// @route POST /api/guest-carts/:cart_code/subtotal
// @access Public
exports.updateGuestCartSubtotal = asyncHandler(async (req, res) => {
  const { cart_code } = req.params;
  const { session_id, name, value, type } = req.body;

  // Enhanced validation
  if (!session_id || !name || typeof name !== "string") {
    return res.status(400).json({ 
      success: false, 
      message: 'Session ID and valid name are required' 
    });
  }

  const parsedValue = parseFloat(value);
  if (isNaN(parsedValue)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Valid numeric value is required' 
    });
  }

  // Validate type field if your schema requires it
  const validTypes = ['charge', 'discount', 'tax', 'shipping', 'fee'];
  const itemType = type || 'charge'; // Default to 'charge' if not provided
  if (!validTypes.includes(itemType)) {
    return res.status(400).json({
      success: false,
      message: `Type must be one of: ${validTypes.join(', ')}`
    });
  }

  // Find guest cart
  const guestCart = await GuestCart.findOne({ 
    cart_code, 
    session_id 
  });

  if (!guestCart) {
    return res.status(404).json({ 
      success: false, 
      message: 'Guest cart not found' 
    });
  }

  try {
    // Check if this subtotal name already exists → update instead of duplicating
    const existingItemIndex = guestCart.subtotal.findIndex(item => item.name === name);
    
    if (existingItemIndex !== -1) {
      guestCart.subtotal[existingItemIndex].value = parsedValue;
      guestCart.subtotal[existingItemIndex].type = itemType;
    } else {
      guestCart.subtotal.push({
        name,
        value: parsedValue,
        type: itemType
      });
    }

    // Recalculate total with discounts and new subtotal adjustments
    await recalculateGuestCartTotal(guestCart);
    await guestCart.save();

    // Populate and return updated cart
    const updatedCart = await GuestCart.findById(guestCart._id)
      .populate('products.product_id');

    res.json({ 
      success: true, 
      message: 'Guest cart subtotal updated',
      data: updatedCart 
    });
  } catch (error) {
    console.error("Error updating guest cart subtotal:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error updating subtotal: " + error.message 
    });
  }
});

// @desc Remove subtotal item - ENHANCED
// @route DELETE /api/guest-carts/:cart_code/subtotal/:name
// @access Public
exports.removeGuestCartSubtotalItem = asyncHandler(async (req, res) => {
  const { cart_code, name } = req.params;
  const { session_id } = req.body;

  if (!session_id) {
    return res.status(400).json({ 
      success: false, 
      message: 'Session ID is required' 
    });
  }

  // Find guest cart
  const guestCart = await GuestCart.findOne({ 
    cart_code, 
    session_id 
  });

  if (!guestCart) {
    return res.status(404).json({ 
      success: false, 
      message: 'Guest cart not found' 
    });
  }

  // Remove subtotal item
  guestCart.subtotal = guestCart.subtotal.filter(item => item.name !== name);
  
  // Recalculate total after removing subtotal item
  await recalculateGuestCartTotal(guestCart);
  await guestCart.save();

  // Populate and return updated cart
  const updatedCart = await GuestCart.findById(guestCart._id)
    .populate('products.product_id');

  res.json({ 
    success: true, 
    message: 'Subtotal item removed from guest cart',
    data: updatedCart 
  });
});

// @desc Remove quantity of a product from guest cart - NEW
// @route PUT /api/guest-carts/:cart_code/remove-quantity
// @access Public
exports.removeGuestCartProductQuantity = asyncHandler(async (req, res) => {
  const { cart_code } = req.params;
  const { session_id, product_id, quantity } = req.body;

  if (!session_id || !product_id || !quantity) {
    return res.status(400).json({ success: false, message: 'Session ID, product_id and quantity are required' });
  }

  const parsedQuantity = parseInt(quantity);
  if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
    return res.status(400).json({ success: false, message: 'Quantity must be a positive number' });
  }

  const guestCart = await GuestCart.findOne({ cart_code, session_id });
  if (!guestCart) {
    return res.status(404).json({ success: false, message: 'Guest cart not found' });
  }

  const productIndex = guestCart.products.findIndex(p => p.product_id.toString() === product_id);
  if (productIndex === -1) {
    return res.status(404).json({ success: false, message: 'Product not found in guest cart' });
  }

  const currentQuantity = guestCart.products[productIndex].quantity;

  if (parsedQuantity >= currentQuantity) {
    // Remove product completely if quantity to remove is equal or more
    guestCart.products.splice(productIndex, 1);
  } else {
    // Reduce quantity only
    guestCart.products[productIndex].quantity = currentQuantity - parsedQuantity;

    // Recalculate discount for the remaining quantity
    const productPrice = parseFloat(guestCart.products[productIndex].price) || 0;
    const discountResult = await applyBestDiscount(product_id, productPrice, guestCart.products[productIndex].quantity);

    guestCart.products[productIndex].finalPrice = roundToTwo(parseFloat(discountResult.finalPrice) || productPrice);
    guestCart.products[productIndex].discountAmount = roundToTwo(parseFloat(discountResult.discountAmount) || 0);
    guestCart.products[productIndex].discountApplied = Boolean(discountResult.discountApplied);
    guestCart.products[productIndex].appliedDiscount = discountResult.appliedDiscount;
  }

  // Recalculate total
  await recalculateGuestCartTotal(guestCart);
  await guestCart.save();

  // Populate and return updated cart
  const updatedCart = await GuestCart.findById(guestCart._id)
    .populate('products.product_id');

  res.json({ success: true, data: updatedCart });
});

// @desc Refresh guest cart discounts (recalculate all discounts) - NEW
// @route PUT /api/guest-carts/:cart_code/refresh-discounts
// @access Public
exports.refreshGuestCartDiscounts = asyncHandler(async (req, res) => {
  const { cart_code } = req.params;
  const { session_id } = req.body;

  if (!session_id) {
    return res.status(400).json({ 
      success: false, 
      message: 'Session ID is required' 
    });
  }

  const guestCart = await GuestCart.findOne({ cart_code, session_id });
  if (!guestCart) {
    return res.status(404).json({ success: false, message: 'Guest cart not found' });
  }

  if (!guestCart.products || guestCart.products.length === 0) {
    return res.json({ 
      success: true, 
      message: 'Guest cart is empty, no discounts to refresh',
      data: guestCart 
    });
  }

  // Recalculate all discounts
  await recalculateGuestCartTotal(guestCart);
  await guestCart.save();

  // Populate and return updated cart
  const updatedCart = await GuestCart.findById(guestCart._id)
    .populate('products.product_id');

  res.json({ 
    success: true, 
    message: 'Guest cart discounts refreshed successfully',
    data: updatedCart 
  });
});

// @desc Get guest cart summary with detailed discount breakdown - NEW
// @route GET /api/guest-carts/:cart_code/summary
// @access Public
exports.getGuestCartSummary = asyncHandler(async (req, res) => {
  const { cart_code } = req.params;
  const { session_id } = req.query;

  if (!session_id) {
    return res.status(400).json({ 
      success: false, 
      message: 'Session ID is required' 
    });
  }

  let guestCart = await GuestCart.findOne({ cart_code, session_id });
  if (!guestCart) {
    return res.status(404).json({ success: false, message: 'Guest cart not found' });
  }

  if (guestCart.products && guestCart.products.length > 0) {
    guestCart = await recalculateGuestCartTotal(guestCart);
    await guestCart.save();
  }

  const summary = {
    cartCode: guestCart.cart_code,
    sessionId: guestCart.session_id,
    itemCount: guestCart.products.length,
    totalQuantity: guestCart.products.reduce((acc, p) => acc + p.quantity, 0),
    pricing: {
      subtotal: guestCart.discountInfo?.totalOriginalAmount || 0,
      discountAmount: guestCart.discountInfo?.totalDiscountAmount || 0,
      afterDiscounts: guestCart.discountInfo?.totalFinalAmount || 0,
      adjustments: guestCart.subtotal.reduce((acc, item) => acc + (item.value || 0), 0),
      finalTotal: guestCart.total
    },
    discounts: {
      hasDiscounts: guestCart.discountInfo?.hasDiscounts || false,
      totalSavings: guestCart.discountInfo?.totalDiscountAmount || 0,
      appliedDiscounts: guestCart.discountInfo?.discountsApplied || [],
      discountBreakdown: guestCart.products
        .filter(p => p.discountApplied)
        .map(p => ({
          productId: p.product_id,
          originalPrice: p.price,
          discountedPrice: p.finalPrice,
          discountAmount: p.discountAmount,
          quantity: p.quantity,
          totalSavings: p.discountAmount * p.quantity,
          discountType: p.appliedDiscount?.type,
          discountMethod: p.appliedDiscount?.method
        }))
    },
    adjustments: guestCart.subtotal
  };

  res.json({ success: true, data: summary });
});

// Apply voucher to guest cart - NEW
exports.applyVoucherToGuestCart = async (req, res) => {
  try {
    const { voucher_code, cart_code, session_id } = req.body;
    if (!voucher_code || !cart_code || !session_id) {
      return res.status(400).json({ success: false, message: 'voucher_code, cart_code and session_id are required' });
    }

    let guestCart = await GuestCart.findOne({ cart_code, session_id });
    if (!guestCart) {
      return res.status(404).json({ success: false, message: 'Guest cart not found' });
    }

    // Apply current discounts first
    if (guestCart.products && guestCart.products.length > 0) {
      guestCart = await recalculateGuestCartTotal(guestCart);
    }

    // Apply voucher
    const result = await applyVoucherToCart(voucher_code, guestCart);
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Unapply voucher from guest cart - NEW
exports.unapplyVoucherFromGuestCart = async (req, res) => {
  try {
    const { voucher_code, cart_code, session_id } = req.body;
    if (!voucher_code || !cart_code || !session_id) {
      return res.status(400).json({ success: false, message: 'voucher_code, cart_code and session_id are required' });
    }

    let guestCart = await GuestCart.findOne({ cart_code, session_id });
    if (!guestCart) {
      return res.status(404).json({ success: false, message: 'Guest cart not found' });
    }

    // Remove voucher first
    const result = await removeVoucherFromCart(voucher_code, guestCart);
    
    // Then reapply discounts
    if (guestCart.products && guestCart.products.length > 0) {
      await recalculateGuestCartTotal(guestCart);
      await guestCart.save();
    }
    
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Extend guest cart expiration
// @route PUT /api/guest-carts/:cart_code/extend
// @access Public
exports.extendGuestCartExpiration = asyncHandler(async (req, res) => {
  const { cart_code } = req.params;
  const { session_id, days } = req.body;

  if (!session_id) {
    return res.status(400).json({ 
      success: false, 
      message: 'Session ID is required' 
    });
  }

  // Find guest cart
  const guestCart = await GuestCart.findOne({ 
    cart_code, 
    session_id 
  });

  if (!guestCart) {
    return res.status(404).json({ 
      success: false, 
      message: 'Guest cart not found' 
    });
  }

  await guestCart.extendExpiration(days || 7);

  res.json({ 
    success: true, 
    message: 'Guest cart expiration extended',
    expires_at: guestCart.expiresAt
  });
});

// @desc Get all guest carts (Admin only)
// @route GET /api/guest-carts
// @access Private/Admin
exports.getAllGuestCarts = asyncHandler(async (req, res) => {
  const { session_id, limit, page } = req.query;
  
  let query = {};
  if (session_id) {
    query.session_id = session_id;
  }

  const options = {
    limit: parseInt(limit) || 50,
    skip: (parseInt(page) - 1) * (parseInt(limit) || 50) || 0,
    sort: { updatedAt: -1 }
  };

  const guestCarts = await GuestCart.find(query)
    .populate('products.product_id')
    .limit(options.limit)
    .skip(options.skip)
    .sort(options.sort);

  const totalCount = await GuestCart.countDocuments(query);

  res.json({ 
    success: true, 
    count: guestCarts.length,
    total: totalCount,
    page: parseInt(page) || 1,
    pages: Math.ceil(totalCount / (parseInt(limit) || 50)),
    data: guestCarts 
  });
});

// @desc Delete expired guest carts (Admin/Cleanup)
// @route DELETE /api/guest-carts/cleanup
// @access Private/Admin
exports.cleanupExpiredGuestCarts = asyncHandler(async (req, res) => {
  const result = await GuestCart.deleteMany({ 
    expiresAt: { $lt: new Date() } 
  });

  res.json({ 
    success: true, 
    message: `Cleaned up ${result.deletedCount} expired guest carts` 
  });
});