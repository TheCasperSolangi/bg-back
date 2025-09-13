const express = require('express');
const router = express.Router();
const appSettingsController = require('../controllers/appSettingsController');

// Routes
router.get('/', appSettingsController.getAppSettings);
router.post('/', appSettingsController.createOrUpdateAppSettings);
router.put('/', appSettingsController.createOrUpdateAppSettings);
router.delete('/', appSettingsController.deleteAppSettings);

module.exports = router;