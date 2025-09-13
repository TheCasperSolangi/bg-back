const express = require('express');
const { createCategory, getCategories } = require('../controllers/categoriesController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();

router
  .route('/')
  .get(getCategories)
  .post(protect, authorizeRoles('admin'), createCategory);

module.exports = router;