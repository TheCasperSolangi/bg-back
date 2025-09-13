const express = require('express');
const router = express.Router();
const authCtrl = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/register', authCtrl.register);
router.post('/login', authCtrl.login);
router.post('/forgot-password', authCtrl.forgotPassword);
router.post('/reset-password/:token', authCtrl.resetPassword);
router.post('/refresh-session', protect, authCtrl.refreshSession);
router.post('/social-login', authCtrl.socialLogin);
router.get('/me', protect, authCtrl.getProfile);
router.post('/guest-login', authCtrl.guestLogin);
module.exports = router;