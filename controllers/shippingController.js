const ShippingMethod = require('../models/shipping_method_api');
const asyncHandler = require('../utils/asyncHandler');

// @desc    Create shipping method
// @route   POST /api/shipping
// @access  Private (admin)
exports.createShippingMethod = asyncHandler(async (req, res) => {
  const { shipipng_code, shipping_name, shipping_types } = req.body;

  if (!shipipng_code || !shipping_name) {
    return res.status(400).json({ success: false, message: "Shipping code and name are required" });
  }

  const exists = await ShippingMethod.findOne({ shipipng_code });
  if (exists) {
    return res.status(400).json({ success: false, message: "Shipping code already exists" });
  }

  const shippingMethod = await ShippingMethod.create({
    shipipng_code,
    shipping_name,
    shipping_types,
  });

  res.status(201).json({ success: true, data: shippingMethod });
});

// @desc    Get all shipping methods
// @route   GET /api/shipping
// @access  Public
exports.getAllShippingMethods = asyncHandler(async (req, res) => {
  const methods = await ShippingMethod.find();
  res.json({ success: true, count: methods.length, data: methods });
});

// @desc    Get a single shipping method by code
// @route   GET /api/shipping/:code
// @access  Public
exports.getShippingMethodByCode = asyncHandler(async (req, res) => {
  const method = await ShippingMethod.findOne({ shipipng_code: req.params.code });
  if (!method) {
    return res.status(404).json({ success: false, message: "Shipping method not found" });
  }
  res.json({ success: true, data: method });
});

// @desc    Update shipping method
// @route   PUT /api/shipping/:id
// @access  Private (admin)
exports.updateShippingMethod = asyncHandler(async (req, res) => {
  const { shipping_name, shipping_types } = req.body;

  const method = await ShippingMethod.findById(req.params.id);
  if (!method) {
    return res.status(404).json({ success: false, message: "Shipping method not found" });
  }

  if (shipping_name) method.shipping_name = shipping_name;
  if (shipping_types) method.shipping_types = shipping_types;

  await method.save();
  res.json({ success: true, data: method });
});

// @desc    Delete shipping method
// @route   DELETE /api/shipping/:id
// @access  Private (admin)
exports.deleteShippingMethod = asyncHandler(async (req, res) => {
  const method = await ShippingMethod.findById(req.params.id);
  if (!method) {
    return res.status(404).json({ success: false, message: "Shipping method not found" });
  }

  await method.deleteOne();
  res.json({ success: true, message: "Shipping method deleted successfully" });
});