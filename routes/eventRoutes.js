const express = require('express');
const router = express.Router();
const {
    addStoreEvent,
    addProductEvent,
    addCategoryEvent
} = require('../controllers/eventController');

// Store Event
router.post('/store', addStoreEvent);

// Product Event
router.post('/product', addProductEvent);

// Category Event
router.post('/category', addCategoryEvent);

module.exports = router;