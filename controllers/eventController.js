const Event = require('../models/events');
const asyncHandler = require('../utils/asyncHandler');

// @desc    Add Store Event
// @route   POST /api/events/store
exports.addStoreEvent = asyncHandler(async (req, res) => {
    const { event_type, event_country, event_city, event_ip, user_id, session_id, device_type, os, browser, referrer_url, campaign_code, extra_data } = req.body;

    if (!event_type || !event_country) {
        return res.status(400).json({ message: 'event_type and event_country are required' });
    }

    const newEvent = await Event.create({
        event_type,
        event_on: 'store',
        event_country,
        event_city,
        event_ip: event_ip || req.ip,
        user_id,
        session_id,
        device_type,
        os,
        browser,
        referrer_url,
        campaign_code,
        extra_data
    });

    res.status(201).json({ success: true, data: newEvent });
});

// @desc    Add Product Event
// @route   POST /api/events/product
exports.addProductEvent = asyncHandler(async (req, res) => {
    const { event_type, product_code, event_country, event_city, event_ip, user_id, session_id, device_type, os, browser, referrer_url, campaign_code, extra_data } = req.body;

    if (!event_type || !product_code || !event_country) {
        return res.status(400).json({ message: 'event_type, product_code and event_country are required' });
    }

    const newEvent = await Event.create({
        event_type,
        event_on: 'product',
        product_code,
        event_country,
        event_city,
        event_ip: event_ip || req.ip,
        user_id,
        session_id,
        device_type,
        os,
        browser,
        referrer_url,
        campaign_code,
        extra_data
    });

    res.status(201).json({ success: true, data: newEvent });
});

// @desc    Add Category Event
// @route   POST /api/events/category
exports.addCategoryEvent = asyncHandler(async (req, res) => {
    const { event_type, category_code, event_country, event_city, event_ip, user_id, session_id, device_type, os, browser, referrer_url, campaign_code, extra_data } = req.body;

    if (!event_type || !category_code || !event_country) {
        return res.status(400).json({ message: 'event_type, category_code and event_country are required' });
    }

    const newEvent = await Event.create({
        event_type,
        event_on: 'category',
        category_code,
        event_country,
        event_city,
        event_ip: event_ip || req.ip,
        user_id,
        session_id,
        device_type,
        os,
        browser,
        referrer_url,
        campaign_code,
        extra_data
    });

    res.status(201).json({ success: true, data: newEvent });
});