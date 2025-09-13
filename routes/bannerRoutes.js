const express = require('express');
const router = express.Router();
const bannerController = require('../controllers/bannerSlides');
const {getPromotions, getPromotionById, createPromotion, updatePromotion, deletePromotion} = require('../controllers/promotionController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

router.get('/',  bannerController.getAllBanners);

router.get('/:id', protect, bannerController.getBannerById);

router.post('/', protect, authorizeRoles('admin'), bannerController.createBanner);

router.put('/:id', protect, authorizeRoles('admin'), bannerController.updateBanner);

router.delete('/:id', protect, authorizeRoles('admin'), bannerController.deleteBanner);
router.get('/', getPromotions);
router.get('/:id', getPromotionById);
router.post('/', createPromotion);
router.put('/:id', updatePromotion);
router.delete('/:id', deletePromotion);


module.exports = router;