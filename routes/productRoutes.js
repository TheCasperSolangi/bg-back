const express = require('express');
const {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  getProductsByCategory,
  getFeaturedProducts,
  getRelatedProducts,
  getProductsOnDiscount,
  getProductPricing,
  getBestSellers,
  getProductByProductCode, // renamed properly
  searchProduct,
  getNewArrivals
} = require('../controllers/productController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();

// Public routes
router.get('/arrivals/new-arrivals', getNewArrivals)
router.get('/search', searchProduct);
router.get('/trending/bestsellers/all', getBestSellers);
router.get('/featured', getFeaturedProducts);
router.get('/on-discount', getProductsOnDiscount);
router.get('/category/:category_code', getProductsByCategory);
router.get('/by-code/:product_code', getProductByProductCode); // ✅ product_code route
router.get('/:id/pricing', getProductPricing);
router.get('/:id/related', getRelatedProducts);


// Product list & creation
router
  .route('/')
  .get(getProducts)
  .post(protect, authorizeRoles('admin'), createProduct);

// Single product by ID (CRUD)
router
  .route('/:id')
  .get(getProductById)
  .put(protect, authorizeRoles('admin'), updateProduct)
  .delete(protect, authorizeRoles('admin'), deleteProduct);


module.exports = router;