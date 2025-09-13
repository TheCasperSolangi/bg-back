const asyncHandler = require("../utils/asyncHandler");
const Reedem = require("../models/redeems");
const User = require("../models/User"); // import User model

// @desc    Create a reedem
// @route   POST /api/redeems
// @access  Private/Admin
exports.createReedem = asyncHandler(async (req, res) => {
  const { reedemable_code, required_points, value } = req.body;

  const exists = await Reedem.findOne({ reedemable_code });
  if (exists) {
    res.status(400);
    throw new Error("Reedemable code already exists");
  }

  const reedem = await Reedem.create({
    reedemable_code,
    required_points,
    value
  });

  res.status(201).json({ success: true, data: reedem });
});

// @desc    Get all affordable reedems for the user
// @route   GET /api/redeems
// @access  Private (requires token)
// @desc    Get all affordable reedems for the user
// @route   GET /api/redeems
// @access  Private (requires token)
exports.getReedems = asyncHandler(async (req, res) => {
  // req.user is populated by protect middleware (from Auth)
  const authUser = req.user;

  // find the User profile linked by email
  const user = await User.findOne({ username: authUser.username });
  if (!user) {
    res.status(404);
    throw new Error("User profile not found");
  }

  // get only redeemables the user can afford
  const affordableReedems = await Reedem.find({
    required_points: { $lte: user.reward_points || 0 }
  }).sort({ createdAt: -1 });

  res.json({
    success: true,
    user_points: user.reward_points,
    count: affordableReedems.length,
    data: affordableReedems
  });
});

// @desc    Get single reedem
// @route   GET /api/redeems/:id
// @access  Public
exports.getReedem = asyncHandler(async (req, res) => {
  const reedem = await Reedem.findById(req.params.id);
  if (!reedem) {
    res.status(404);
    throw new Error("Reedem not found");
  }
  res.json({ success: true, data: reedem });
});

// @desc    Update reedem
// @route   PUT /api/redeems/:id
// @access  Private/Admin
exports.updateReedem = asyncHandler(async (req, res) => {
  const reedem = await Reedem.findById(req.params.id);

  if (!reedem) {
    res.status(404);
    throw new Error("Reedem not found");
  }

  reedem.reedemable_code = req.body.reedemable_code || reedem.reedemable_code;
  reedem.required_points = req.body.required_points || reedem.required_points;
  reedem.value = req.body.value || reedem.value;

  const updated = await reedem.save();

  res.json({ success: true, data: updated });
});

// @desc    Delete reedem
// @route   DELETE /api/redeems/:id
// @access  Private/Admin
exports.deleteReedem = asyncHandler(async (req, res) => {
  const reedem = await Reedem.findById(req.params.id);

  if (!reedem) {
    res.status(404);
    throw new Error("Reedem not found");
  }

  await reedem.deleteOne();

  res.json({ success: true, message: "Reedem deleted successfully" });
});
