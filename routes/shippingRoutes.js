const express = require('express');
const router = express.Router();
const {
  createShippingMethod,
  getAllShippingMethods,
  getShippingMethodByCode,
  updateShippingMethod,
  deleteShippingMethod
} = require('../controllers/shippingController');

// Admin routes
router.post('/', createShippingMethod);
router.put('/:id', updateShippingMethod);
router.delete('/:id', deleteShippingMethod);

// Public routes
router.get('/', getAllShippingMethods);
router.get('/:code', getShippingMethodByCode);

module.exports = router;