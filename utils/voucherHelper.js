const Voucher = require('../models/voucher');
const Cart = require('../models/cart');

/**
 * Calculate the base products total from cart.products
 * @param {Array} products - Array of products in cart
 * @returns {Number} - Total price of products
 */
const calculateProductsTotal = (products) => {
  return products.reduce((acc, p) => acc + (p.price * p.quantity), 0);
};

/**
 * Validate and apply voucher to cart
 * @param {String} voucherCode - Code of the voucher
 * @param {Object} cart - Cart object from DB
 * @returns {Object} - { success, message, updatedCart }
 */
exports.applyVoucherToCart = async (voucherCode, cart) => {
  // 1. Find the voucher
  const voucher = await Voucher.findOne({ voucher_code: voucherCode });
  if (!voucher) {
    return { success: false, message: 'Voucher not found' };
  }

  // 2. Check if voucher is already applied
  const isAlreadyApplied = cart.subtotal.some(item =>
    item.name && item.name.includes(`Voucher Applied (${voucherCode})`)
  );
  if (isAlreadyApplied) {
    return { success: false, message: 'Voucher already applied' };
  }

  // 3. Validate based on type
  const now = new Date();

  if (voucher.voucher_type === 'promotion_voucher') {
    if (!voucher.start_date || !voucher.end_date) {
      return { success: false, message: 'Promotion voucher missing dates' };
    }
    if (now < new Date(voucher.start_date) || now > new Date(voucher.end_date)) {
      return { success: false, message: 'Voucher not active' };
    }
  }

  // Limited voucher check
  if (voucher.voucher_type === 'limited-voucher') {
    if (voucher.max_attempts <= 0) {
      return { success: false, message: 'Voucher usage limit reached' };
    }
  }

  // 4. Calculate the base products total
  const productsTotal = calculateProductsTotal(cart.products);

  // 5. Calculate discount or fixed price adjustment (with cap applied for both types)
  let discountValue = 0;
  if (voucher.pricing_type === 'fixed') {
    discountValue = voucher.voucher_value;
  } else if (voucher.pricing_type === 'discounted') {
    discountValue = (productsTotal * voucher.voucher_value) / 100; // % discount
  }

  // Apply cap if enabled
  if (voucher.is_capped === 'true' && voucher.capped_amount) {
    discountValue = Math.min(discountValue, voucher.capped_amount);
  }

  // 6. Add to cart subtotal as discount
  cart.subtotal.push({
    name: `Voucher Applied (${voucherCode})`,
    value: -discountValue
  });

  // 7. Recalculate total: products total + all subtotal adjustments
  const subtotalAdjustments = cart.subtotal.reduce((acc, item) => acc + item.value, 0);
  cart.total = Math.max(0, productsTotal + subtotalAdjustments); // Ensure total doesn't go negative

  // 8. Save updated cart
  const updatedCart = await cart.save();

  // 9. Decrease attempts for limited voucher
  if (voucher.voucher_type === 'limited-voucher') {
    voucher.max_attempts -= 1;
    await voucher.save();
  }

  return { success: true, message: 'Voucher applied successfully', updatedCart };
};

/**
 * Remove voucher discount from cart
 * @param {String} voucherCode - Voucher code to remove
 * @param {Object} cart - Cart object from DB
 */
exports.removeVoucherFromCart = async (voucherCode, cart) => {
  const beforeTotal = cart.total;

  // Remove discount line from subtotal
  const voucherPattern = `Voucher Applied (${voucherCode})`;
  cart.subtotal = cart.subtotal.filter(item =>
    !item.name || !item.name.includes(voucherPattern)
  );

  // Recalculate total: products total + remaining subtotal adjustments
  const productsTotal = calculateProductsTotal(cart.products);
  const subtotalAdjustments = cart.subtotal.reduce((acc, item) => acc + item.value, 0);
  cart.total = Math.max(0, productsTotal + subtotalAdjustments);

  const updatedCart = await cart.save();

  // Optional: Restore voucher attempts for limited vouchers
  try {
    const voucher = await Voucher.findOne({ voucher_code: voucherCode });
    if (voucher && voucher.voucher_type === 'limited-voucher') {
      voucher.max_attempts += 1;
      await voucher.save();
    }
  } catch (error) {
    console.warn('Could not restore voucher attempts:', error.message);
  }

  return {
    success: true,
    message: `Voucher ${voucherCode} removed`,
    updatedCart,
    totalDifference: cart.total - beforeTotal
  };
};
