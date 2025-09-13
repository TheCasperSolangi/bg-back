const express = require('express');
const router = express.Router();
const {
  getGuestCartBySession,
  getGuestCartByCode,
  createOrGetGuestCart,
  addProductToGuestCart,
  updateGuestCartProductQuantity,
  removeProductFromGuestCart,
  clearGuestCart,
  updateGuestCartSubtotal,
  removeGuestCartSubtotalItem,
  removeGuestCartProductQuantity,
  refreshGuestCartDiscounts,
  getGuestCartSummary,
  applyVoucherToGuestCart,
  unapplyVoucherFromGuestCart,
  extendGuestCartExpiration,
  getAllGuestCarts,
  cleanupExpiredGuestCarts
} = require('../controllers/guestCartContoller');

// Basic guest cart operations
router.post('/', createOrGetGuestCart);                                    // Create or get guest cart
router.get('/session/:session_id', getGuestCartBySession);                // Get cart by session
router.get('/:cart_code', getGuestCartByCode);                           // Get cart by code

// Product management
router.post('/:cart_code/add-product', addProductToGuestCart);            // Add product to cart
router.put('/:cart_code/products/:product_id', updateGuestCartProductQuantity); // Update product quantity
router.delete('/:cart_code/products/:product_id', removeProductFromGuestCart);  // Remove product
router.put('/:cart_code/remove-quantity', removeGuestCartProductQuantity); // Remove specific quantity

// Cart management
router.delete('/:cart_code/clear', clearGuestCart);                       // Clear entire cart
router.put('/:cart_code/refresh-discounts', refreshGuestCartDiscounts);   // Refresh discounts
router.get('/:cart_code/summary', getGuestCartSummary);                   // Get cart summary

// Subtotal management
router.post('/:cart_code/subtotal', updateGuestCartSubtotal);             // Add/update subtotal item
router.delete('/:cart_code/subtotal/:name', removeGuestCartSubtotalItem); // Remove subtotal item

// Voucher management
router.post('/apply-voucher', applyVoucherToGuestCart);                   // Apply voucher
router.post('/unapply-voucher', unapplyVoucherFromGuestCart);             // Remove voucher

// Utility endpoints
router.put('/:cart_code/extend', extendGuestCartExpiration);              // Extend expiration

// Admin endpoints
router.get('/', getAllGuestCarts);                                        // Get all carts (admin)
router.delete('/cleanup', cleanupExpiredGuestCarts);                      // Cleanup expired carts

module.exports = router;