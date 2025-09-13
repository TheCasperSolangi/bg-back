const Promotions = require('../models/promotionBanner');

// @desc Get all promotions
// @route GET /api/promotions
exports.getPromotions = async (req, res) => {
  try {
    const promotions = await Promotions.find();
    res.status(200).json({ success: true, count: promotions.length, data: promotions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// @desc Get single promotion
// @route GET /api/promotions/:id
exports.getPromotionById = async (req, res) => {
  try {
    const promotion = await Promotions.findById(req.params.id);
    if (!promotion) {
      return res.status(404).json({ success: false, error: "Promotion not found" });
    }
    res.status(200).json({ success: true, data: promotion });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// @desc Create new promotion
// @route POST /api/promotions
exports.createPromotion = async (req, res) => {
  try {
    const promotion = await Promotions.create(req.body);
    res.status(201).json({ success: true, data: promotion });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// @desc Update promotion
// @route PUT /api/promotions/:id
exports.updatePromotion = async (req, res) => {
  try {
    const promotion = await Promotions.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    if (!promotion) {
      return res.status(404).json({ success: false, error: "Promotion not found" });
    }
    res.status(200).json({ success: true, data: promotion });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// @desc Delete promotion
// @route DELETE /api/promotions/:id
exports.deletePromotion = async (req, res) => {
  try {
    const promotion = await Promotions.findByIdAndDelete(req.params.id);
    if (!promotion) {
      return res.status(404).json({ success: false, error: "Promotion not found" });
    }
    res.status(200).json({ success: true, message: "Promotion deleted" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};