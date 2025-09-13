const express = require('express');
const router = express.Router();
const {
  createOrGetCart,
  getCartByUsername,
  addProductToCart,
  removeProductFromCart,
  clearCart,
  getCartByCode,
  deleteCartByCode,
  applyVoucher,
  unapplyVoucher,
  removeProductQuantity,
  updateProductQuantity,
  addSubtotal,
  addProductToCartViaQR
} = require('../controllers/cartController');

// Create a new cart or get existing cart by cart_code
router.post('/', createOrGetCart);

// Get cart by username
router.get('/:username', getCartByUsername);
router.put('/:cart_code/add-subtotal', addSubtotal )
// Add product to cart by cart_code
router.put('/:cart_code/add-product', addProductToCart);
router.get('/:cart_code/add-product-barcode', addProductToCartViaQR);
// Remove product from cart by cart_code
router.put('/:cart_code/remove-product', removeProductFromCart);

// Clear entire cart by cart_code
router.delete('/:cart_code', clearCart);
router.get('/code/:cart_code', getCartByCode);
router.delete('/code/:cart_code', deleteCartByCode);
// Apply / Unapply voucher routes
router.post('/apply-voucher', applyVoucher);
router.post('/unapply-voucher', unapplyVoucher);
// Remove quantity of a product (new endpoint)
router.put('/:cart_code/remove-quantity', removeProductQuantity);
router.put('/:cart_code/update-quantity', updateProductQuantity)

module.exports = router;