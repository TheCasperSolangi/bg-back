const express = require('express');
const router = express.Router();
const voucherController = require('../controllers/voucherController');

// Routes
router.post('/', voucherController.createVoucher);
router.get('/', voucherController.getAllVouchers);
router.get('/:id', voucherController.getVoucherById);
router.put('/:id', voucherController.updateVoucher);
router.delete('/:id', voucherController.deleteVoucher);

module.exports = router;