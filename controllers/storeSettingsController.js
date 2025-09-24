const StoreSettings = require('../models/storeSettings');

exports.getStoreSettings = async (req, res) => {
  try {
    let settings;

    const vendorCode = req.headers["x-vendor-code"];
    const vendorSubdomain = req.headers["x-vendor-subdomain"];

    if (vendorCode) {
      // ✅ Authenticated path → plugin will auto-scope
      settings = await StoreSettings.findOne();
    } else if (vendorSubdomain) {
      // ✅ Unauthenticated path → manually query by subdomain (bypass plugin scoping)
      settings = await StoreSettings.findOne({ vendor_subdomain: vendorSubdomain.toLowerCase().trim() }).lean();
    } else {
      return res.status(400).json({ message: "x-vendor-code or x-vendor-subdomain header is required" });
    }

    if (!settings) {
      return res.status(404).json({ message: "Store settings not found" });
    }

    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
// 🔹 Create or Update store settings for the current vendor
exports.createOrUpdateStoreSettings = async (req, res) => {
  try {
    let settings = await StoreSettings.findOne();

    if (settings) {
      Object.keys(req.body).forEach((key) => {
        if (Array.isArray(req.body[key])) {
          settings[key] = req.body[key];
        } else if (req.body[key] !== undefined) {
          settings[key] = req.body[key];
        }
      });

      await settings.save();
      return res.json({ message: 'Store settings updated successfully', data: settings });
    } else {
      settings = new StoreSettings(req.body);
      await settings.save();
      return res.status(201).json({ message: 'Store settings created successfully', data: settings });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// 🔹 Update store settings by ID
exports.updateStoreSettings = async (req, res) => {
  try {
    const settings = await StoreSettings.findById(req.params.id);

    if (!settings) {
      return res.status(404).json({ message: 'Settings not found' });
    }

    Object.keys(req.body).forEach((key) => {
      settings[key] = req.body[key];
    });

    const updatedSettings = await settings.save();
    res.json({ message: 'Store settings updated successfully', data: updatedSettings });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 🔹 Prevent deletion
exports.deleteStoreSettings = (req, res) => {
  return res.status(403).json({ message: 'Deletion of store settings is not allowed' });
};
