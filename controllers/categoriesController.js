const Category = require('../models/categories');
const asyncHandler = require('../utils/asyncHandler');

// Create category (avoid duplication and include all fields)
exports.createCategory = asyncHandler(async (req, res) => {
  const {
    category_code,
    category_name,
    description,
    short_description,
    image,
    icon,
    metaTitle,
    metaDesc,
    keywords
  } = req.body;

  // Check if a category with same code or name exists
  const existingCategory = await Category.findOne({
    $or: [
      { category_code },
      { category_name }
    ]
  });

  if (existingCategory) {
    return res.status(400).json({
      success: false,
      message: 'Category with the same code or name already exists'
    });
  }

  // Create new category with enhanced fields
  const category = await Category.create({
    category_code,
    category_name,
    description,
    short_description,
    image,
    icon,
    metaTitle,
    metaDesc,
    keywords
  });

  res.status(201).json({ success: true, data: category });
});

// Get all categories
exports.getCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find();
  res.status(200).json({ success: true, count: categories.length, data: categories });
});
