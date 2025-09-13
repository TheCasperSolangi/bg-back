const Discount = require('../models/Discount');
const asyncHandler = require('../utils/asyncHandler');

// @desc Create a new discount
// @route POST /api/discounts
// @access Private/Admin
exports.createDiscount = asyncHandler(async (req, res) => {
  const {
    discount_type,
    product_id,
    discount_method,
    value,
    start_date,
    end_date,
    status,
    is_capped, capped_amount
  } = req.body;

  // Validation
  if (!discount_type || !discount_method || !value || !start_date || is_capped === undefined || !capped_amount) {
    return res.status(400).json({
      success: false,
      message: 'discount_type, discount_method, value, start_date, and is_capped are required'
    });
  }

  // If discount_type is 'product', product_id is required
  if (discount_type === 'product' && !product_id) {
    return res.status(400).json({
      success: false,
      message: 'product_id is required for product-specific discounts'
    });
  }

  // Validate percentage values
  if (discount_method === 'percentage' && (value < 0 || value > 100)) {
    return res.status(400).json({
      success: false,
      message: 'Percentage discount value must be between 0 and 100'
    });
  }

  // Validate fixed amount values
  if (discount_method === 'fixed' && value < 0) {
    return res.status(400).json({
      success: false,
      message: 'Fixed discount value must be greater than or equal to 0'
    });
  }

  // Check for existing active discount on the same product
  if (discount_type === 'product') {
    const existingDiscount = await Discount.findOne({
      product_id,
      status: 'active',
      $or: [
        { end_date: { $exists: false } },
        { end_date: null },
        { end_date: { $gte: new Date().toISOString() } }
      ]
    });

    if (existingDiscount) {
      return res.status(400).json({
        success: false,
        message: 'An active discount already exists for this product'
      });
    }
  }

  const discount = await Discount.create({
    discount_type,
    product_id: discount_type === 'product' ? product_id : undefined,
    discount_method,
    value,
    start_date,
    end_date,
    status: status || 'active',
    is_capped,
    capped_amount
  });

  res.status(201).json({
    success: true,
    data: discount
  });
});

// @desc Get all discounts
// @route GET /api/discounts
// @access Private/Admin
exports.getDiscounts = asyncHandler(async (req, res) => {
  const { status, discount_type, active_only } = req.query;
  let query = {};

  if (status) {
    query.status = status;
  }

  if (discount_type) {
    query.discount_type = discount_type;
  }

  // Filter only active discounts that are currently valid
  if (active_only === 'true') {
    const currentDate = new Date().toISOString();
    query.status = 'active';
    query.start_date = { $lte: currentDate };
    query.$or = [
      { end_date: { $exists: false } },
      { end_date: null },
      { end_date: { $gte: currentDate } }
    ];
  }

  const discounts = await Discount.find(query).sort({ createdAt: -1 });

  res.json({
    success: true,
    count: discounts.length,
    data: discounts
  });
});

// @desc Get discount by ID
// @route GET /api/discounts/:id
// @access Private/Admin
exports.getDiscountById = asyncHandler(async (req, res) => {
  const discount = await Discount.findById(req.params.id);

  if (!discount) {
    return res.status(404).json({
      success: false,
      message: 'Discount not found'
    });
  }

  res.json({
    success: true,
    data: discount
  });
});

// @desc Update discount
// @route PUT /api/discounts/:id
// @access Private/Admin
exports.updateDiscount = asyncHandler(async (req, res) => {
  const { discount_method, value } = req.body;

  // Validate percentage values if being updated
  if (discount_method === 'percentage' && value !== undefined && (value < 0 || value > 100)) {
    return res.status(400).json({
      success: false,
      message: 'Percentage discount value must be between 0 and 100'
    });
  }

  // Validate fixed amount values if being updated
  if (discount_method === 'fixed' && value !== undefined && value < 0) {
    return res.status(400).json({
      success: false,
      message: 'Fixed discount value must be greater than or equal to 0'
    });
  }

  const discount = await Discount.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  );

  if (!discount) {
    return res.status(404).json({
      success: false,
      message: 'Discount not found'
    });
  }

  res.json({
    success: true,
    data: discount
  });
});

// @desc Delete discount
// @route DELETE /api/discounts/:id
// @access Private/Admin
exports.deleteDiscount = asyncHandler(async (req, res) => {
  const discount = await Discount.findByIdAndDelete(req.params.id);

  if (!discount) {
    return res.status(404).json({
      success: false,
      message: 'Discount not found'
    });
  }

  res.json({
    success: true,
    message: 'Discount deleted successfully'
  });
});

// @desc Get active discounts for a specific product
// @route GET /api/discounts/product/:product_id
// @access Public
exports.getProductDiscounts = asyncHandler(async (req, res) => {
  const { product_id } = req.params;
  const currentDate = new Date().toISOString();

  // Find active product-specific discounts
  const productDiscounts = await Discount.find({
    product_id,
    discount_type: 'product',
    status: 'active',
    start_date: { $lte: currentDate },
    $or: [
      { end_date: { $exists: false } },
      { end_date: null },
      { end_date: { $gte: currentDate } }
    ]
  });

  // Find active campaign discounts
  const campaignDiscounts = await Discount.find({
    discount_type: 'campaign',
    status: 'active',
    start_date: { $lte: currentDate },
    $or: [
      { end_date: { $exists: false } },
      { end_date: null },
      { end_date: { $gte: currentDate } }
    ]
  });

  const allDiscounts = [...productDiscounts, ...campaignDiscounts];

  res.json({
    success: true,
    count: allDiscounts.length,
    data: {
      product_discounts: productDiscounts,
      campaign_discounts: campaignDiscounts,
      all_discounts: allDiscounts
    }
  });
});

// @desc Toggle discount status
// @route PATCH /api/discounts/:id/toggle-status
// @access Private/Admin
exports.toggleDiscountStatus = asyncHandler(async (req, res) => {
  const discount = await Discount.findById(req.params.id);

  if (!discount) {
    return res.status(404).json({
      success: false,
      message: 'Discount not found'
    });
  }

  discount.status = discount.status === 'active' ? 'inactive' : 'active';
  await discount.save();

  res.json({
    success: true,
    data: discount,
    message: `Discount ${discount.status === 'active' ? 'activated' : 'deactivated'} successfully`
  });
});

// @desc Get active campaign discounts
// @route GET /api/discounts/campaigns/active
// @access Public
exports.getActiveCampaignDiscounts = asyncHandler(async (req, res) => {
const currentDate = new Date();
const campaignDiscounts = await Discount.find({
  discount_type: 'campaign',
  status: { $regex: /^active$/i },
  $or: [
    { start_date: { $lte: new Date() } }, // already started
    { start_date: { $gte: new Date() } }  // upcoming
  ]
}).sort({ createdAt: -1 });

  res.json({
    success: true,
    count: campaignDiscounts.length,
    data: campaignDiscounts
  });
});