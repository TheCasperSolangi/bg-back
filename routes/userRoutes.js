const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

router.get('/', protect, authorizeRoles('admin'), userController.getAllUsers);

router.get('/:username', protect, userController.getUserByUsername);

router.post('/', protect, authorizeRoles('admin'), userController.createUser);

router.put('/:username', protect, userController.updateUser);

router.delete('/:username', protect, authorizeRoles('admin'), userController.deleteUser);

// =======================
// Wallet routes
// =======================
router.get('/:username/wallet', protect, userController.fetchUserWalletBalance);
router.patch('/:username/credit', protect, userController.creditBalance);
router.patch('/:username/debit', protect, userController.debitBalance);

// Redeem reward points → wallet balance
router.post('/:username/redeem', protect, userController.redeemRewardPoints);

// =======================
// Address routes
// =======================
router.get('/:username/addresses', protect, userController.getAddresses);
router.post('/:username/addresses', protect, userController.addAddress);
router.put('/:username/addresses/:index', protect, userController.updateAddress);
router.delete('/:username/addresses/:index', protect, userController.deleteAddress);

// =======================
// Payment method routes
// =======================
router.get('/:username/payment-methods', protect, userController.getPaymentMethods);
router.post('/:username/payment-methods', protect, userController.addPaymentMethod);
router.put('/:username/payment-methods/:card_code', protect, userController.updatePaymentMethod);
router.delete('/:username/payment-methods/:card_code', protect, userController.deletePaymentMethod);

module.exports = router;
