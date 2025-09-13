const Banners = require('../models/banner');

// GET /api/banners - Admin only: get all banners
exports.getAllBanners = async (req, res) => {
  try {
    const banners = await Banners.find();
    res.status(200).json({success: true, items: banners.length, data: banners})
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/banners/:id - Get banner by ID (admin or any authenticated user)
exports.getBannerById = async (req, res) => {
  try {
    const { id } = req.params;
    const banner = await Banners.findById(id);
    if (!banner) return res.status(404).json({ message: 'Banner not found' });
    res.json(banner);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/banners - Admin only: create banner
exports.createBanner = async (req, res) => {
  try {
    const { banner_title, banner_name, banner_image } = req.body;

    // Optional: You can add uniqueness checks on banner_name if needed

    const banner = new Banners({ banner_title, banner_name, banner_image });
    await banner.save();

    res.status(201).json(banner);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/banners/:id - Admin only: update banner
exports.updateBanner = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const updatedBanner = await Banners.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true
    });

    if (!updatedBanner) return res.status(404).json({ message: 'Banner not found' });

    res.json(updatedBanner);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/banners/:id - Admin only: delete banner
exports.deleteBanner = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedBanner = await Banners.findByIdAndDelete(id);
    if (!deletedBanner) return res.status(404).json({ message: 'Banner not found' });

    res.json({ message: 'Banner deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};