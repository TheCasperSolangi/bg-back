const express = require('express');
const router = express.Router();
const storeSettingsController = require('../controllers/storeSettingsController');

// Routes
router.get('/', storeSettingsController.getstoreSettings);
router.post('/', storeSettingsController.createOrUpdatestoreSettings);
router.put('/', storeSettingsController.updateStoreSettings);
router.delete('/', storeSettingsController.deletestoreSettings);

module.exports = router;