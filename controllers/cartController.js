const Cart = require('../models/cart');
const asyncHandler = require('../utils/asyncHandler');
const Product = require('../models/product');
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
const recalculateCartTotal = async (cart) => {
  if (!cart) {
    throw new Error('Cart is required');
  }
  
  try {
    // Apply discounts to cart first
    const cartWithDiscounts = await applyDiscountsToCart(cart);
    
    // The applyDiscountsToCart function already calculates the correct totals
    // Round to 2 decimal places to avoid floating point precision issues
    const productsTotal = roundToTwo(cartWithDiscounts.discountInfo?.totalFinalAmount || 0);
    
    // Safely calculate subtotal adjustments
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
    cart.products = cartWithDiscounts.products || [];
    cart.subtotal = cartWithDiscounts.subtotal || [];
    
    // Round discountInfo values as well
    if (cartWithDiscounts.discountInfo) {
      cartWithDiscounts.discountInfo.totalOriginalAmount = roundToTwo(cartWithDiscounts.discountInfo.totalOriginalAmount || 0);
      cartWithDiscounts.discountInfo.totalFinalAmount = roundToTwo(cartWithDiscounts.discountInfo.totalFinalAmount || 0);
      cartWithDiscounts.discountInfo.totalDiscountAmount = roundToTwo(cartWithDiscounts.discountInfo.totalDiscountAmount || 0);
    }
    
    cart.discountInfo = cartWithDiscounts.discountInfo || {
      totalOriginalAmount: 0,
      totalFinalAmount: 0,
      totalDiscountAmount: 0,
      hasDiscounts: false,
      discountsApplied: []
    };
    
    // Calculate final total and round
    const finalTotal = productsTotal + roundedSubtotalAdjustments;
    cart.total = isNaN(finalTotal) ? 0 : roundToTwo(Math.max(0, finalTotal));
    
    // Debug logging
    console.log('Cart calculation debug:', {
      productsTotal,
      subtotalAdjustments: roundedSubtotalAdjustments,
      finalTotal,
      cartTotal: cart.total,
      discountInfoFinalAmount: cart.discountInfo.totalFinalAmount
    });
    
    return cart;
  } catch (error) {
    console.error('Error in recalculateCartTotal:', error);
    throw error;
  }
};

// @desc Create a new cart (if not exists) or return existing
// @route POST /api/carts
// @access Private (based on username)
exports.createOrGetCart = asyncHandler(async (req, res) => {
  const { cart_code, username } = req.body;

  if (!cart_code || !username) {
    return res.status(400).json({ success: false, message: 'cart_code and username are required' });
  }

  let cart = await Cart.findOne({ cart_code });

  if (!cart) {
    cart = await Cart.create({
      cart_code,
      username,
      products: [],
      subtotal: [],
      total: 0,
    });
  }

  // Apply discounts to existing cart if it has products
  if (cart.products && cart.products.length > 0) {
    cart = await recalculateCartTotal(cart);
    await cart.save();
  }

  res.json({ success: true, data: cart });
});

// @desc Get cart by username with discount information
// @route GET /api/carts/:username
// @access Private (or public)
exports.getCartByUsername = asyncHandler(async (req, res) => {
  const { username } = req.params;
  const { include_discounts = 'true' } = req.query;

  let cart = await Cart.findOne({ username });

  if (!cart) {
    return res.status(404).json({ success: false, message: 'Cart not found' });
  }

  // Apply current discounts if requested
  if (include_discounts === 'true' && cart.products && cart.products.length > 0) {
    cart = await recalculateCartTotal(cart);
    await cart.save();
  }

  res.json({
    success: true,
    data: cart,
  });
});

// @desc Add product to cart with automatic discount application - FIXED
exports.addProductToCart = asyncHandler(async (req, res) => {
  const { cart_code } = req.params;
  let { product_id, quantity } = req.body;

  // Enhanced validation
  if (!product_id || !quantity) {
    return res.status(400).json({
      success: false,
      message: 'Valid product_id or product_code and quantity are required'
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

  const cart = await Cart.findOne({ cart_code });
  if (!cart) {
    return res.status(404).json({ success: false, message: 'Cart not found' });
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
    const existingProductIndex = cart.products.findIndex(p => p.product_id.toString() === product_id);

    if (existingProductIndex > -1) {
      // Update quantity and pricing information
      const newQuantity = cart.products[existingProductIndex].quantity + parsedQuantity;
      const updatedDiscountResult = await applyBestDiscount(product_id, productPrice, newQuantity);

      // Validate updated discount result
      if (!updatedDiscountResult || isNaN(updatedDiscountResult.finalPrice)) {
        updatedDiscountResult.finalPrice = productPrice;
        updatedDiscountResult.discountAmount = 0;
        updatedDiscountResult.discountApplied = false;
        updatedDiscountResult.appliedDiscount = null;
      }

      cart.products[existingProductIndex].quantity = newQuantity;
      cart.products[existingProductIndex].price = roundToTwo(productPrice);
      cart.products[existingProductIndex].finalPrice = roundToTwo(parseFloat(updatedDiscountResult.finalPrice) || productPrice);
      cart.products[existingProductIndex].discountAmount = roundToTwo(parseFloat(updatedDiscountResult.discountAmount) || 0);
      cart.products[existingProductIndex].discountApplied = Boolean(updatedDiscountResult.discountApplied);
      cart.products[existingProductIndex].appliedDiscount = updatedDiscountResult.appliedDiscount;
      cart.products[existingProductIndex].product_image = product.productImages && product.productImages.length > 0 ? product.productImages[0] : null;
    } else {
      cart.products.push({
        product_id,
        product_name: product.product_name,
        quantity: parsedQuantity,
        price: roundToTwo(productPrice),
        finalPrice: roundToTwo(parseFloat(discountResult.finalPrice) || productPrice),
        discountAmount: roundToTwo(parseFloat(discountResult.discountAmount) || 0),
        discountApplied: Boolean(discountResult.discountApplied),
        appliedDiscount: discountResult.appliedDiscount,
        product_image: product.productImages && product.productImages.length > 0 ? product.productImages[0] : null
      });
    }

    // Recalculate total with all discounts applied
    await recalculateCartTotal(cart);

    // Final validation before saving
    if (isNaN(cart.total)) {
      console.error('Cart total is still NaN after recalculation');
      cart.total = 0; // Set to 0 as fallback
    }

    await cart.save();

    res.json({ success: true, data: cart });
  } catch (error) {
    console.error('Error adding product to cart:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding product to cart: ' + error.message
    });
  }
});


// @desc Add product to cart via GET request (QR/Barcode ready)
exports.addProductToCartViaQR = asyncHandler(async (req, res) => {
  const { cart_code } = req.params;
  let { product_id, quantity, token } = req.query;

  // --- Security: check token ---
  const SECRET_TOKEN = process.env.QR_SECRET_TOKEN || 'supersecret';
  if (!token || token !== SECRET_TOKEN) {
    return res.status(401).json({ success: false, message: 'Unauthorized access' });
  }

  // --- Validation ---
  if (!product_id || !quantity) {
    return res.status(400).json({ success: false, message: 'product_id and quantity are required' });
  }

  const parsedQuantity = parseInt(quantity);
  if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
    return res.status(400).json({ success: false, message: 'Quantity must be a positive number' });
  }

  // --- Fetch product ---
  let product;
  if (!mongoose.Types.ObjectId.isValid(product_id)) {
    product = await Product.findOne({ product_code: product_id });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found with product_code' });
    product_id = product._id.toString();
  } else {
    product = await Product.findById(product_id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found with _id' });
  }

  // --- Fetch cart ---
  const cart = await Cart.findOne({ cart_code });
  if (!cart) return res.status(404).json({ success: false, message: 'Cart not found' });

  const productPrice = parseFloat(product.price);
  if (isNaN(productPrice) || productPrice < 0) {
    return res.status(400).json({ success: false, message: 'Product has invalid price' });
  }

  try {
    const discountResult = await applyBestDiscount(product_id, productPrice, parsedQuantity);

    // --- Add or update product in cart ---
    const existingIndex = cart.products.findIndex(p => p.product_id.toString() === product_id);
    if (existingIndex > -1) {
      const newQuantity = cart.products[existingIndex].quantity + parsedQuantity;
      const updatedDiscount = await applyBestDiscount(product_id, productPrice, newQuantity);

      cart.products[existingIndex] = {
        ...cart.products[existingIndex],
        quantity: newQuantity,
        price: roundToTwo(productPrice),
        finalPrice: roundToTwo(updatedDiscount.finalPrice || productPrice),
        discountAmount: roundToTwo(updatedDiscount.discountAmount || 0),
        discountApplied: Boolean(updatedDiscount.discountApplied),
        appliedDiscount: updatedDiscount.appliedDiscount,
        product_image: product.productImages?.[0] || null
      };
    } else {
      cart.products.push({
        product_id,
        quantity: parsedQuantity,
        price: roundToTwo(productPrice),
        finalPrice: roundToTwo(discountResult.finalPrice || productPrice),
        discountAmount: roundToTwo(discountResult.discountAmount || 0),
        discountApplied: Boolean(discountResult.discountApplied),
        appliedDiscount: discountResult.appliedDiscount,
        product_image: product.productImages?.[0] || null
      });
    }

    await recalculateCartTotal(cart);
    if (isNaN(cart.total)) cart.total = 0;

    await cart.save();
    res.json({ success: true, data: cart });
  } catch (error) {
    console.error('Error adding product to cart via QR:', error);
    res.status(500).json({ success: false, message: 'Error: ' + error.message });
  }
});

// @desc Update product quantity in cart - FIXED
exports.updateProductQuantity = asyncHandler(async (req, res) => {
  const { cart_code } = req.params;
  const { product_id, quantity } = req.body;

  // Enhanced validation
  const parsedQuantity = parseInt(quantity);
  if (!product_id || isNaN(parsedQuantity) || parsedQuantity <= 0) {
    return res.status(400).json({ 
      success: false, 
      message: 'Valid product_id and positive quantity are required' 
    });
  }

  const cart = await Cart.findOne({ cart_code });
  if (!cart) {
    return res.status(404).json({ success: false, message: 'Cart not found' });
  }

  const productIndex = cart.products.findIndex(p => p.product_id.toString() === product_id);
  if (productIndex === -1) {
    return res.status(404).json({ success: false, message: 'Product not found in cart' });
  }

  try {
    // Update quantity and recalculate discount for new quantity
    const product = cart.products[productIndex];
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

    cart.products[productIndex].quantity = parsedQuantity;
    cart.products[productIndex].finalPrice = roundToTwo(parseFloat(discountResult.finalPrice) || productPrice);
    cart.products[productIndex].discountAmount = roundToTwo(parseFloat(discountResult.discountAmount) || 0);
    cart.products[productIndex].discountApplied = Boolean(discountResult.discountApplied);
    cart.products[productIndex].appliedDiscount = discountResult.appliedDiscount;

    // Recalculate total with all discounts applied
    await recalculateCartTotal(cart);
    
    // Final validation
    if (isNaN(cart.total)) {
      cart.total = 0;
    }
    
    await cart.save();

    res.json({ success: true, data: cart });
  } catch (error) {
    console.error('Error updating product quantity:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error updating quantity: ' + error.message 
    });
  }
});
// @desc Remove product from cart
// @route PUT /api/carts/:cart_code/remove-product
// @access Private
exports.removeProductFromCart = asyncHandler(async (req, res) => {
  const { cart_code } = req.params;
  const { product_id } = req.body;

  if (!product_id) {
    return res.status(400).json({ success: false, message: 'product_id is required' });
  }

  const cart = await Cart.findOne({ cart_code });
  if (!cart) {
    return res.status(404).json({ success: false, message: 'Cart not found' });
  }

  cart.products = cart.products.filter(p => p.product_id.toString() !== product_id);

  // Recalculate total with remaining products and their discounts
  await recalculateCartTotal(cart);
  await cart.save();

  res.json({ success: true, data: cart });
});

// @desc Clear the entire cart
// @route DELETE /api/carts/:cart_code
// @access Private
exports.clearCart = asyncHandler(async (req, res) => {
  const { cart_code } = req.params;

  const cart = await Cart.findOne({ cart_code });
  if (!cart) {
    return res.status(404).json({ success: false, message: 'Cart not found' });
  }

  cart.products = [];
  cart.subtotal = [];
  cart.total = 0;
  cart.discountInfo = {
    totalOriginalAmount: 0,
    totalFinalAmount: 0,
    totalDiscountAmount: 0,
    discountsApplied: []
  };

  await cart.save();

  res.json({ success: true, message: 'Cart cleared successfully' });
});

// @desc Get cart by cart_code with discount information
// @route GET /api/carts/code/:cart_code
// @access Private (or public)
exports.getCartByCode = asyncHandler(async (req, res) => {
  const { cart_code } = req.params;
  const { include_discounts = 'true' } = req.query;

  let cart = await Cart.findOne({ cart_code });

  if (!cart) {
    return res.status(404).json({ success: false, message: 'Cart not found' });
  }

  // Apply current discounts if requested
  if (include_discounts === 'true' && cart.products && cart.products.length > 0) {
    cart = await recalculateCartTotal(cart);
    await cart.save();
  }

  res.json({ success: true, data: cart });
});

// @desc Delete cart by cart_code
// @route DELETE /api/carts/code/:cart_code
// @access Private
exports.deleteCartByCode = asyncHandler(async (req, res) => {
  const { cart_code } = req.params;

  const cart = await Cart.findOneAndDelete({ cart_code });

  if (!cart) {
    return res.status(404).json({ success: false, message: 'Cart not found' });
  }

  res.json({ success: true, message: 'Cart deleted successfully' });
});

// @desc Refresh cart discounts (recalculate all discounts)
// @route PUT /api/carts/:cart_code/refresh-discounts
// @access Private
exports.refreshCartDiscounts = asyncHandler(async (req, res) => {
  const { cart_code } = req.params;

  const cart = await Cart.findOne({ cart_code });
  if (!cart) {
    return res.status(404).json({ success: false, message: 'Cart not found' });
  }

  if (!cart.products || cart.products.length === 0) {
    return res.json({ 
      success: true, 
      message: 'Cart is empty, no discounts to refresh',
      data: cart 
    });
  }

  // Recalculate all discounts
  await recalculateCartTotal(cart);
  await cart.save();

  res.json({ 
    success: true, 
    message: 'Cart discounts refreshed successfully',
    data: cart 
  });
});

// @desc Get cart summary with detailed discount breakdown
// @route GET /api/carts/:cart_code/summary
// @access Private
exports.getCartSummary = asyncHandler(async (req, res) => {
  const { cart_code } = req.params;

  let cart = await Cart.findOne({ cart_code });
  if (!cart) {
    return res.status(404).json({ success: false, message: 'Cart not found' });
  }

  if (cart.products && cart.products.length > 0) {
    cart = await recalculateCartTotal(cart);
    await cart.save();
  }

  const summary = {
    cartCode: cart.cart_code,
    username: cart.username,
    itemCount: cart.products.length,
    totalQuantity: cart.products.reduce((acc, p) => acc + p.quantity, 0),
    pricing: {
      subtotal: cart.discountInfo?.totalOriginalAmount || 0,
      discountAmount: cart.discountInfo?.totalDiscountAmount || 0,
      afterDiscounts: cart.discountInfo?.totalFinalAmount || 0,
      adjustments: cart.subtotal.reduce((acc, item) => acc + (item.value || 0), 0),
      finalTotal: cart.total
    },
    discounts: {
      hasDiscounts: cart.discountInfo?.hasDiscounts || false,
      totalSavings: cart.discountInfo?.totalDiscountAmount || 0,
      appliedDiscounts: cart.discountInfo?.discountsApplied || [],
      discountBreakdown: cart.products
        .filter(p => p.discountApplied)
        .map(p => ({
          productId: p.product_id,
          product_name: p.product_name,
          originalPrice: p.price,
          discountedPrice: p.finalPrice,
          discountAmount: p.discountAmount,
          quantity: p.quantity,
          totalSavings: p.discountAmount * p.quantity,
          discountType: p.appliedDiscount?.type,
          discountMethod: p.appliedDiscount?.method
        }))
    },
    adjustments: cart.subtotal
  };

  res.json({ success: true, data: summary });
});

// Apply voucher to cart (existing functionality)
exports.applyVoucher = async (req, res) => {
  try {
    const { voucher_code, cart_code } = req.body;
    if (!voucher_code || !cart_code) {
      return res.status(400).json({ success: false, message: 'voucher_code and cart_code are required' });
    }

    let cart = await Cart.findOne({ cart_code });
    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart not found' });
    }

    // Apply current discounts first
    if (cart.products && cart.products.length > 0) {
      cart = await recalculateCartTotal(cart);
    }

    // Apply voucher
    const result = await applyVoucherToCart(voucher_code, cart);
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Unapply voucher from cart (existing functionality)
exports.unapplyVoucher = async (req, res) => {
  try {
    const { voucher_code, cart_code } = req.body;
    if (!voucher_code || !cart_code) {
      return res.status(400).json({ success: false, message: 'voucher_code and cart_code are required' });
    }

    let cart = await Cart.findOne({ cart_code });
    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart not found' });
    }

    // Remove voucher first
    const result = await removeVoucherFromCart(voucher_code, cart);
    
    // Then reapply discounts
    if (cart.products && cart.products.length > 0) {
      await recalculateCartTotal(cart);
      await cart.save();
    }
    
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Remove quantity of a product from cart
// @route PUT /api/carts/:cart_code/remove-quantity
// @access Private
exports.removeProductQuantity = asyncHandler(async (req, res) => {
  const { cart_code } = req.params;
  const { product_id, quantity } = req.body;

  if (!product_id || !quantity) {
    return res.status(400).json({ success: false, message: 'product_id and quantity are required' });
  }

  const parsedQuantity = parseInt(quantity);
  if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
    return res.status(400).json({ success: false, message: 'Quantity must be a positive number' });
  }

  const cart = await Cart.findOne({ cart_code });
  if (!cart) {
    return res.status(404).json({ success: false, message: 'Cart not found' });
  }

  const productIndex = cart.products.findIndex(p => p.product_id.toString() === product_id);
  if (productIndex === -1) {
    return res.status(404).json({ success: false, message: 'Product not found in cart' });
  }

  const currentQuantity = cart.products[productIndex].quantity;

  if (parsedQuantity >= currentQuantity) {
    // Remove product completely if quantity to remove is equal or more
    cart.products.splice(productIndex, 1);
  } else {
    // Reduce quantity only
    cart.products[productIndex].quantity = currentQuantity - parsedQuantity;

    // Recalculate discount for the remaining quantity
    const productPrice = parseFloat(cart.products[productIndex].price) || 0;
    const discountResult = await applyBestDiscount(product_id, productPrice, cart.products[productIndex].quantity);

    cart.products[productIndex].finalPrice = roundToTwo(parseFloat(discountResult.finalPrice) || productPrice);
    cart.products[productIndex].discountAmount = roundToTwo(parseFloat(discountResult.discountAmount) || 0);
    cart.products[productIndex].discountApplied = Boolean(discountResult.discountApplied);
    cart.products[productIndex].appliedDiscount = discountResult.appliedDiscount;
  }

  // Recalculate total
  await recalculateCartTotal(cart);
  await cart.save();

  res.json({ success: true, data: cart });
});

// @desc Add a subtotal adjustment (e.g. delivery charges, tax)
// @route PUT /api/carts/:cart_code/add-subtotal
// @access Private
exports.addSubtotal = asyncHandler(async (req, res) => {
  const { cart_code } = req.params;
  const { name, value } = req.body;

  // Validation
  if (!name || typeof name !== "string") {
    return res.status(400).json({ success: false, message: "Valid name is required" });
  }
  const parsedValue = parseFloat(value);
  if (isNaN(parsedValue)) {
    return res.status(400).json({ success: false, message: "Valid numeric value is required" });
  }

  const cart = await Cart.findOne({ cart_code });
  if (!cart) {
    return res.status(404).json({ success: false, message: "Cart not found" });
  }

  try {
    // Check if this subtotal name already exists → update instead of duplicating
    const existingIndex = cart.subtotal.findIndex(item => item.name === name);

    if (existingIndex > -1) {
      cart.subtotal[existingIndex].value = parsedValue;
    } else {
      cart.subtotal.push({ name, value: parsedValue });
    }

    // Recalculate total with discounts and new subtotal adjustments
    await recalculateCartTotal(cart);
    await cart.save();

    res.json({ success: true, data: cart });
  } catch (error) {
    console.error("Error adding subtotal:", error);
    res.status(500).json({ success: false, message: "Error adding subtotal: " + error.message });
  }
});