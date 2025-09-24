const express = require('express');
const router = express.Router();
// ✅ Correct
const storeSettingsController = require('../controllers/storeSettingsController');

router.get('/', storeSettingsController.getStoreSettings);
router.post('/', storeSettingsController.createOrUpdateStoreSettings);
router.put('/:id', storeSettingsController.updateStoreSettings);
router.delete('/:id', storeSettingsController.deleteStoreSettings);

module.exports = router;