const Discount = require('../models/Discount');

/**
 * Calculate discount amount for a given price and discount
 * @param {number} originalPrice - The original price
 * @param {object} discount - The discount object
 * @param {number} quantity - The quantity (for total discount calculation)
 * @returns {object} - Object containing discounted price and discount amount
 */
const calculateDiscount = (originalPrice, discount, quantity = 1) => {
  if (!discount || !originalPrice || originalPrice <= 0) {
    return {
      discountedPrice: originalPrice,
      discountAmount: 0,
      discountApplied: false
    };
  }

  let discountAmountPerItem = 0;
  const totalOriginalPrice = originalPrice * quantity;

  if (discount.discount_method === 'percentage') {
    // Calculate percentage discount
    discountAmountPerItem = (originalPrice * discount.value) / 100;
    
    // Apply cap for percentage discounts (this makes sense)
    if (discount.is_capped && discount.capped_amount && discount.capped_amount > 0) {
      const totalDiscountBeforeCap = discountAmountPerItem * quantity;
      const cappedTotalDiscount = Math.min(totalDiscountBeforeCap, discount.capped_amount);
      discountAmountPerItem = cappedTotalDiscount / quantity;
    }
  } else if (discount.discount_method === 'fixed') {
    // For fixed discounts, apply the fixed value as total discount
    let totalDiscountAmount = discount.value;
    
    // For fixed discounts, capped_amount usually shouldn't be used
    // But if it exists and is LOWER than the fixed value, apply it (unusual case)
    if (discount.is_capped && discount.capped_amount && discount.capped_amount > 0 && discount.capped_amount < discount.value) {
      totalDiscountAmount = discount.capped_amount;
      console.log(`Fixed discount capped from ${discount.value} to ${discount.capped_amount}`);
    }
    
    // Don't discount more than the total price
    totalDiscountAmount = Math.min(totalDiscountAmount, totalOriginalPrice);
    
    // Distribute the discount across all items
    discountAmountPerItem = totalDiscountAmount / quantity;
  }

  // Ensure we don't discount more than the item price
  discountAmountPerItem = Math.min(discountAmountPerItem, originalPrice);

  const discountedPrice = Math.max(0, originalPrice - discountAmountPerItem);

  console.log(`Discount calculation: originalPrice=${originalPrice}, quantity=${quantity}, discountAmountPerItem=${discountAmountPerItem}, discountedPrice=${discountedPrice}`);

  return {
    discountedPrice: parseFloat(discountedPrice.toFixed(2)),
    discountAmount: parseFloat(discountAmountPerItem.toFixed(2)),
    discountApplied: discountAmountPerItem > 0,
    discountDetails: {
      id: discount._id,
      type: discount.discount_type,
      method: discount.discount_method,
      value: discount.value,
      is_capped: discount.is_capped,
      capped_amount: discount.capped_amount
    }
  };
};

/**
 * Get active discounts for a specific product
 * @param {string} productId - The product ID
 * @returns {Promise<Array>} - Array of active discounts
 */
const getActiveProductDiscounts = async (productId) => {
  // FIXED: Use proper date comparison - convert to start of day
  const currentDate = new Date();
  const currentDateString = currentDate.toISOString().split('T')[0]; // YYYY-MM-DD format
  
  console.log('Current date for discount check:', currentDateString); // Debug log

  try {
    // Get product-specific discounts
    const productDiscounts = await Discount.find({
      product_id: productId,
      discount_type: 'product',
      status: 'active',
      start_date: { $lte: currentDateString },
      $or: [
        { end_date: { $exists: false } },
        { end_date: null },
        { end_date: { $gte: currentDateString } }
      ]
    }).sort({ value: -1 }); // Sort by discount value descending

    // Get campaign discounts (apply to all products)
    const campaignDiscounts = await Discount.find({
      discount_type: 'campaign',
      status: 'active',
      start_date: { $lte: currentDateString },
      $or: [
        { end_date: { $exists: false } },
        { end_date: null },
        { end_date: { $gte: currentDateString } }
      ]
    }).sort({ value: -1 }); // Sort by discount value descending

    console.log('Found product discounts:', productDiscounts.length); // Debug log
    console.log('Found campaign discounts:', campaignDiscounts.length); // Debug log
    
    if (campaignDiscounts.length > 0) {
      console.log('Campaign discount details:', campaignDiscounts[0]); // Debug log
    }

    return {
      productDiscounts,
      campaignDiscounts,
      allDiscounts: [...productDiscounts, ...campaignDiscounts]
    };
  } catch (error) {
    console.error('Error fetching active discounts:', error);
    return {
      productDiscounts: [],
      campaignDiscounts: [],
      allDiscounts: []
    };
  }
};

/**
 * Apply the best available discount to a product
 * @param {string} productId - The product ID
 * @param {number} originalPrice - The original price
 * @param {number} quantity - The quantity (default: 1)
 * @returns {Promise<object>} - Object containing pricing details with discount applied
 */
const applyBestDiscount = async (productId, originalPrice, quantity = 1) => {
  console.log(`Applying discount to product ${productId} with price ${originalPrice}`); // Debug log
  
  if (!productId || !originalPrice || originalPrice <= 0) {
    return {
      originalPrice,
      finalPrice: originalPrice,
      totalOriginal: originalPrice * quantity,
      totalFinal: originalPrice * quantity,
      discountAmount: 0,
      totalDiscountAmount: 0,
      discountApplied: false,
      appliedDiscount: null
    };
  }

  try {
    const { allDiscounts } = await getActiveProductDiscounts(productId);
    
    console.log(`Found ${allDiscounts.length} total discounts for product ${productId}`); // Debug log

    if (!allDiscounts || allDiscounts.length === 0) {
      console.log('No discounts found, returning original price'); // Debug log
      return {
        originalPrice,
        finalPrice: originalPrice,
        totalOriginal: originalPrice * quantity,
        totalFinal: originalPrice * quantity,
        discountAmount: 0,
        totalDiscountAmount: 0,
        discountApplied: false,
        appliedDiscount: null
      };
    }

    // Find the best discount (highest discount amount)
    let bestDiscount = null;
    let bestDiscountResult = null;
    let maxDiscountAmount = 0;

    for (const discount of allDiscounts) {
      console.log(`Testing discount: ${discount.discount_type}, method: ${discount.discount_method}, value: ${discount.value}, capped: ${discount.is_capped}, cap_amount: ${discount.capped_amount}`); // Debug log
      
      const discountResult = calculateDiscount(originalPrice, discount, quantity);
      
      console.log(`Discount result: amount=${discountResult.discountAmount}, applied=${discountResult.discountApplied}, discountedPrice=${discountResult.discountedPrice}`); // Debug log
      
      if (discountResult.discountAmount > maxDiscountAmount) {
        maxDiscountAmount = discountResult.discountAmount;
        bestDiscountResult = discountResult;
        bestDiscount = discount;
      }
    }

    if (bestDiscountResult && bestDiscountResult.discountApplied) {
      console.log(`Best discount applied: ${maxDiscountAmount} discount`); // Debug log
      return {
        originalPrice,
        finalPrice: bestDiscountResult.discountedPrice, // Use the discounted price per item
        totalOriginal: originalPrice * quantity,
        totalFinal: bestDiscountResult.discountedPrice * quantity,
        discountAmount: bestDiscountResult.discountAmount,
        totalDiscountAmount: bestDiscountResult.discountAmount * quantity,
        discountApplied: true,
        appliedDiscount: {
          id: bestDiscount._id,
          type: bestDiscount.discount_type,
          method: bestDiscount.discount_method,
          value: bestDiscount.value,
          cap: bestDiscount.is_capped
        }
      };
    }

    // No applicable discount found
    console.log('No applicable discount found'); // Debug log
    return {
      originalPrice,
      finalPrice: originalPrice,
      totalOriginal: originalPrice * quantity,
      totalFinal: originalPrice * quantity,
      discountAmount: 0,
      totalDiscountAmount: 0,
      discountApplied: false,
      appliedDiscount: null
    };

  } catch (error) {
    console.error('Error applying discount:', error);
    // Return original pricing if there's an error
    return {
      originalPrice,
      finalPrice: originalPrice,
      totalOriginal: originalPrice * quantity,
      totalFinal: originalPrice * quantity,
      discountAmount: 0,
      totalDiscountAmount: 0,
      discountApplied: false,
      appliedDiscount: null,
      error: error.message
    };
  }
};

/**
 * Apply discounts to a cart's products
 * @param {object} cart - The cart object with products array
 * @returns {Promise<object>} - Updated cart with discount information
 */
const applyDiscountsToCart = async (cart) => {
  if (!cart || !cart.products || cart.products.length === 0) {
    return {
      ...cart,
      discountInfo: {
        totalOriginalAmount: 0,
        totalFinalAmount: 0,
        totalDiscountAmount: 0,
        discountsApplied: []
      }
    };
  }

  try {
    let totalOriginalAmount = 0;
    let totalFinalAmount = 0;
    let totalDiscountAmount = 0;
    const discountsApplied = [];
    const updatedProducts = [];

    for (const product of cart.products) {
      const discountResult = await applyBestDiscount(
        product.product_id,
        product.price,
        product.quantity
      );

      totalOriginalAmount += discountResult.totalOriginal;
      totalFinalAmount += discountResult.totalFinal;
      totalDiscountAmount += discountResult.totalDiscountAmount;

      if (discountResult.discountApplied) {
        discountsApplied.push({
          productId: product.product_id,
          discount: discountResult.appliedDiscount,
          originalPrice: discountResult.originalPrice,
          discountedPrice: discountResult.finalPrice,
          discountAmount: discountResult.discountAmount,
          quantity: product.quantity,
          totalDiscountAmount: discountResult.totalDiscountAmount
        });
      }

      updatedProducts.push({
        ...product,
        originalPrice: product.price, // Keep original product price
        finalPrice: discountResult.finalPrice, // Use finalPrice from discountResult
        discountAmount: discountResult.discountAmount, // Discount amount per item
        discountApplied: discountResult.discountApplied,
        appliedDiscount: discountResult.appliedDiscount
      });
    }

    // Update subtotal to include discount information
    const updatedSubtotal = [...(cart.subtotal || [])];
    
    // Remove existing discount entries from subtotal
    const filteredSubtotal = updatedSubtotal.filter(item => 
      !item.name.toLowerCase().includes('discount')
    );

    // Add total discount as a negative subtotal entry if there are discounts
    if (totalDiscountAmount > 0) {
      filteredSubtotal.push({
        name: 'Total Discounts Applied',
        value: -totalDiscountAmount
      });
    }

    // Calculate final total (products total + subtotal adjustments)
    const productsTotal = totalFinalAmount;
    const subtotalAdjustments = filteredSubtotal.reduce((acc, item) => acc + (item.value || 0), 0);
    const finalTotal = Math.max(0, productsTotal + subtotalAdjustments);

    return {
      ...cart,
      products: updatedProducts,
      subtotal: filteredSubtotal,
      total: finalTotal,
      discountInfo: {
        totalOriginalAmount,
        totalFinalAmount,
        totalDiscountAmount,
        discountsApplied,
        hasDiscounts: totalDiscountAmount > 0
      }
    };

  } catch (error) {
    console.error('Error applying discounts to cart:', error);
    return {
      ...cart,
      discountInfo: {
        totalOriginalAmount: 0,
        totalFinalAmount: 0,
        totalDiscountAmount: 0,
        discountsApplied: [],
        error: error.message
      }
    };
  }
};

/**
 * Check if a discount is currently active and valid
 * @param {object} discount - The discount object
 * @returns {boolean} - Whether the discount is active and valid
 */
const isDiscountValid = (discount) => {
  if (!discount || discount.status !== 'active') {
    return false;
  }

  const currentDate = new Date();
  const currentDateString = currentDate.toISOString().split('T')[0]; // YYYY-MM-DD format
  
  // Check if discount has started
  if (currentDateString < discount.start_date) {
    return false;
  }

  // Check if discount has ended (if end_date is specified)
  if (discount.end_date && currentDateString > discount.end_date) {
    return false;
  }

  return true;
};

/**
 * Get discount summary for reporting
 * @param {string} productId - Optional product ID to filter by
 * @returns {Promise<object>} - Discount summary
 */
const getDiscountSummary = async (productId = null) => {
  try {
    const query = {
      status: 'active'
    };

    if (productId) {
      query.$or = [
        { product_id: productId, discount_type: 'product' },
        { discount_type: 'campaign' }
      ];
    }

    const activeDiscounts = await Discount.find(query);
    const currentDateString = new Date().toISOString().split('T')[0];

    const validDiscounts = activeDiscounts.filter(discount => {
      return discount.start_date <= currentDateString && 
             (!discount.end_date || discount.end_date >= currentDateString);
    });

    const summary = {
      totalActiveDiscounts: activeDiscounts.length,
      totalValidDiscounts: validDiscounts.length,
      productDiscounts: validDiscounts.filter(d => d.discount_type === 'product').length,
      campaignDiscounts: validDiscounts.filter(d => d.discount_type === 'campaign').length,
      percentageDiscounts: validDiscounts.filter(d => d.discount_method === 'percentage').length,
      fixedDiscounts: validDiscounts.filter(d => d.discount_method === 'fixed').length,
      cappedDiscounts: validDiscounts.filter(d => d.is_capped > 0).length
    };

    return {
      success: true,
      summary,
      discounts: validDiscounts
    };

  } catch (error) {
    console.error('Error getting discount summary:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = {
  calculateDiscount,
  getActiveProductDiscounts,
  applyBestDiscount,
  applyDiscountsToCart,
  isDiscountValid,
  getDiscountSummary
};