const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

router.get('/', protect, authorizeRoles('admin'), userController.getAllUsers);

router.get('/:username', protect, userController.getUserByUsername);

router.post('/', protect, authorizeRoles('admin'), userController.createUser);

router.put('/:username', protect, userController.updateUser);

router.delete('/:username', protect, authorizeRoles('admin'), userController.deleteUser);

// Wallet routes
router.get('/:username/wallet', userController.fetchUserWalletBalance);
router.patch('/:username/credit',  userController.creditBalance);
router.patch('/:username/debit',  userController.debitBalance);

// CRUD ROUTES FOR ADDRESS AND PAYMENTS 

// Address routes
router.get('/:username/addresses',  userController.getAddresses);
router.post('/:username/addresses',  userController.addAddress);
router.put('/:username/addresses/:index',  userController.updateAddress);
router.delete('/:username/addresses/:index',  userController.deleteAddress);

// Payment method routes
router.get('/:username/payment-methods', userController.getPaymentMethods);
router.post('/:username/payment-methods', userController.addPaymentMethod);
router.put('/:username/payment-methods/:card_code', userController.updatePaymentMethod);
router.delete('/:username/payment-methods/:card_code', userController.deletePaymentMethod);

module.exports = router;