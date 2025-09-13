
const express = require('express');
const router = express.Router();

const {
  createDiscount,
  getDiscounts,
  getDiscountById,
  updateDiscount,
  deleteDiscount,
  getProductDiscounts,
  toggleDiscountStatus,
  getActiveCampaignDiscounts
} = require('../controllers/discountController');

// Basic CRUD routes
router.route('/')
  .post(createDiscount)    // POST /api/discounts
  .get(getDiscounts);      // GET /api/discounts

router.route('/:id')
  .get(getDiscountById)    // GET /api/discounts/:id
  .put(updateDiscount)     // PUT /api/discounts/:id
  .delete(deleteDiscount); // DELETE /api/discounts/:id

// Special routes
router.patch('/:id/toggle-status', toggleDiscountStatus); // PATCH /api/discounts/:id/toggle-status
router.get('/product/:product_id', getProductDiscounts);   // GET /api/discounts/product/:product_id
router.get('/campaigns/active', getActiveCampaignDiscounts); // GET /api/discounts/campaigns/active

module.exports = router;