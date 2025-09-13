const AppSettings = require('../models/appSettings');

// Get the single AppSettings document
exports.getAppSettings = async (req, res) => {
    try {
        const settings = await AppSettings.findOne();
        if (!settings) {
            return res.status(404).json({ message: 'App settings not found' });
        }
        res.json(settings);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Create or Update AppSettings (only one document allowed)
exports.createOrUpdateAppSettings = async (req, res) => {
    try {
        let settings = await AppSettings.findOne();

        if (settings) {
            // Update existing
            settings.set(req.body);
            await settings.save();
            return res.json({ message: 'App settings updated successfully', data: settings });
        } else {
            // Create new
            settings = new AppSettings(req.body);
            await settings.save();
            return res.status(201).json({ message: 'App settings created successfully', data: settings });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Prevent deletion (optional)
exports.deleteAppSettings = (req, res) => {
    return res.status(403).json({ message: 'Deletion of app settings is not allowed' });
};