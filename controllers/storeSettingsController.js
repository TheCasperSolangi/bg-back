const storeSettings = require('../models/storeSettings');

// Get the single storeSettings document
exports.getstoreSettings = async (req, res) => {
    try {
        const settings = await storeSettings.findOne();
        if (!settings) {
            return res.status(404).json({ message: 'App settings not found' });
        }
        res.json(settings);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.createOrUpdatestoreSettings = async (req, res) => {
    try {
        let settings = await storeSettings.findOne();

        if (settings) {
            // Update each key explicitly
            for (let key in req.body) {
                // Overwrite arrays completely
                if (Array.isArray(req.body[key])) {
                    settings[key] = req.body[key];
                } else if (req.body[key] !== undefined) {
                    settings[key] = req.body[key];
                }
            }

            await settings.save();
            return res.json({ message: 'App settings updated successfully', data: settings });
        } else {
            // Create new
            settings = new storeSettings(req.body);
            await settings.save();
            return res.status(201).json({ message: 'App settings created successfully', data: settings });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.updateStoreSettings = async (req, res) => {
  try {
    const settings = await storeSettings.findById(req.params.id);

    if (!settings) {
      return res.status(404).json({ message: 'Settings not found' });
    }

    // Update all fields from req.body
    Object.keys(req.body).forEach((key) => {
      settings[key] = req.body[key];
    });

    const updatedSettings = await settings.save();

    res.json({
      message: 'App settings updated successfully',
      data: updatedSettings
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
// Prevent deletion (optional)
exports.deletestoreSettings = (req, res) => {
    return res.status(403).json({ message: 'Deletion of app settings is not allowed' });
};