const asyncHandler = require('../utils/asyncHandler');
const Taxes = require('../models/taxation');

// @desc    Create new tax
// @route   POST /api/taxes
// @access  Private/Admin
exports.createTax = asyncHandler(async (req, res) => {
  const { tax_code, tax_name, tax_type, value } = req.body;

  // ensure unique tax_code
  const exists = await Taxes.findOne({ tax_code });
  if (exists) {
    return res.status(400).json({ success: false, message: 'Tax code already exists' });
  }

  const tax = await Taxes.create({ tax_code, tax_name, tax_type, value });

  res.status(201).json({ success: true, data: tax });
});

// @desc    Get all taxes
// @route   GET /api/taxes
// @access  Public
exports.getTaxes = asyncHandler(async (req, res) => {
  const taxes = await Taxes.find().sort({ createdAt: -1 });
  res.status(200).json({ success: true, count: taxes.length, data: taxes });
});

// @desc    Get single tax
// @route   GET /api/taxes/:id
// @access  Public
exports.getTaxById = asyncHandler(async (req, res) => {
  const tax = await Taxes.findById(req.params.id);

  if (!tax) {
    return res.status(404).json({ success: false, message: 'Tax not found' });
  }

  res.status(200).json({ success: true, data: tax });
});

// @desc    Update tax
// @route   PUT /api/taxes/:id
// @access  Private/Admin
exports.updateTax = asyncHandler(async (req, res) => {
  const tax = await Taxes.findById(req.params.id);

  if (!tax) {
    return res.status(404).json({ success: false, message: 'Tax not found' });
  }

  const { tax_code, tax_name, tax_type, tax_price } = req.body;

  tax.tax_code = tax_code || tax.tax_code;
  tax.tax_name = tax_name || tax.tax_name;
  tax.tax_type = tax_type || tax.tax_type;
  tax.tax_price = tax_price !== undefined ? tax_price : tax.tax_price;

  await tax.save();

  res.status(200).json({ success: true, data: tax });
});

// @desc    Delete tax
// @route   DELETE /api/taxes/:id
// @access  Private/Admin
exports.deleteTax = asyncHandler(async (req, res) => {
  const tax = await Taxes.findById(req.params.id);

  if (!tax) {
    return res.status(404).json({ success: false, message: 'Tax not found' });
  }

  await tax.deleteOne();

  res.status(200).json({ success: true, message: 'Tax removed successfully' });
});