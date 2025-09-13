const Events = require('../models/events');
const asyncHandler = require('../utils/asyncHandler');

// Helper functions for date ranges
const startOfMonth = (date = new Date()) => new Date(date.getFullYear(), date.getMonth(), 1);
const startOfLastMonth = () => new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
const endOfLastMonth = () => new Date(new Date().getFullYear(), new Date().getMonth(), 0, 23, 59, 59);
const daysAgo = (num) => { const date = new Date(); date.setDate(date.getDate() - num); date.setHours(0,0,0,0); return date; }
const monthsAgo = (num) => { const date = new Date(); return new Date(date.getFullYear(), date.getMonth() - num, 1); }

exports.getStoreAnalytics = asyncHandler(async (req, res) => {
    const now = new Date();
    const startOfThisMonth = startOfMonth();
    const startOfLastMonthDate = startOfLastMonth();
    const endOfLastMonthDate = endOfLastMonth();
    const sevenDaysAgo = daysAgo(6);
    const sixMonthsAgo = monthsAgo(5);
    const oneYearAgo = monthsAgo(11);

    const [
        totalVisitors,
        storeVisitors,
        productVisitors,
        categoryVisitors,
        mostViewedProduct,
        mostViewedCategory,
        thisMonthViews,
        lastMonthViews,
        weeklyChart,
        monthlyChart,
        sixMonthChart,
        oneYearChart,
        viewsByRegion,
        viewsByCity,
        viewsByDevice,
        viewsByOS,
        viewsByBrowser,
        peakHours,
        peakDays,
        peakMonths
    ] = await Promise.all([
        // Total unique visitors
        Events.distinct('session_id').then(ids => ids.length),

        // Store views
        Events.countDocuments({ event_on: 'store' }),

        // Product views
        Events.countDocuments({ event_on: 'product' }),

        // Category views
        Events.countDocuments({ event_on: 'category' }),

        // Most viewed product
        Events.aggregate([
            { $match: { event_on: 'product', product_code: { $exists: true } } },
            { $group: { _id: '$product_code', views: { $sum: 1 } } },
            { $sort: { views: -1 } },
            { $limit: 1 }
        ]),

        // Most viewed category
        Events.aggregate([
            { $match: { event_on: 'category', category_code: { $exists: true } } },
            { $group: { _id: '$category_code', views: { $sum: 1 } } },
            { $sort: { views: -1 } },
            { $limit: 1 }
        ]),

        // This month store views
        Events.countDocuments({ event_on: 'store', createdAt: { $gte: startOfThisMonth } }),

        // Last month store views
        Events.countDocuments({ event_on: 'store', createdAt: { $gte: startOfLastMonthDate, $lte: endOfLastMonthDate } }),

        // Weekly chart (last 7 days)
        Events.aggregate([
            { $match: { event_on: 'store', createdAt: { $gte: sevenDaysAgo } } },
            { $group: { _id: { day: { $dayOfMonth: '$createdAt' }, month: { $month: '$createdAt' }, year: { $year: '$createdAt' } }, views: { $sum: 1 } } },
            { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
            { $project: { _id: 0, label: { $concat: [{ $toString: '$_id.year' }, '-', { $toString: '$_id.month' }, '-', { $toString: '$_id.day' }] }, views: 1 } }
        ]),

        // Monthly chart (current month day-by-day)
        Events.aggregate([
            { $match: { event_on: 'store', createdAt: { $gte: startOfThisMonth } } },
            { $group: { _id: { day: { $dayOfMonth: '$createdAt' } }, views: { $sum: 1 } } },
            { $sort: { '_id.day': 1 } },
            { $project: { _id: 0, label: { $concat: ['Day ', { $toString: '$_id.day' }] }, views: 1 } }
        ]),

        // Six months chart (month-by-month)
        Events.aggregate([
            { $match: { event_on: 'store', createdAt: { $gte: sixMonthsAgo } } },
            { $group: { _id: { month: { $month: '$createdAt' }, year: { $year: '$createdAt' } }, views: { $sum: 1 } } },
            { $sort: { '_id.year': 1, '_id.month': 1 } },
            { $project: { _id: 0, label: { $concat: [{ $toString: '$_id.year' }, '-', { $toString: '$_id.month' }] }, views: 1 } }
        ]),

        // One year chart (month-by-month)
        Events.aggregate([
            { $match: { event_on: 'store', createdAt: { $gte: oneYearAgo } } },
            { $group: { _id: { month: { $month: '$createdAt' }, year: { $year: '$createdAt' } }, views: { $sum: 1 } } },
            { $sort: { '_id.year': 1, '_id.month': 1 } },
            { $project: { _id: 0, label: { $concat: [{ $toString: '$_id.year' }, '-', { $toString: '$_id.month' }] }, views: 1 } }
        ]),

        // Views by country
        Events.aggregate([{ $group: { _id: '$event_country', views: { $sum: 1 } } }, { $sort: { views: -1 } }]),

        // Views by city
        Events.aggregate([{ $group: { _id: '$event_city', views: { $sum: 1 } } }, { $sort: { views: -1 } }]),

        // Views by device
        Events.aggregate([{ $group: { _id: '$device_type', views: { $sum: 1 } } }, { $sort: { views: -1 } }]),

        // Views by OS
        Events.aggregate([{ $group: { _id: '$os', views: { $sum: 1 } } }, { $sort: { views: -1 } }]),

        // Views by Browser
        Events.aggregate([{ $group: { _id: '$browser', views: { $sum: 1 } } }, { $sort: { views: -1 } }]),

        // Peak hours (0-23)
        Events.aggregate([
            { $match: { event_on: 'store' } },
            { $group: { _id: { $hour: '$createdAt' }, views: { $sum: 1 } } },
            { $sort: { views: -1 } },
            { $limit: 5 }
        ]),

        // Peak days (0=Sunday, 6=Saturday)
        Events.aggregate([
            { $match: { event_on: 'store' } },
            { $group: { _id: { $dayOfWeek: '$createdAt' }, views: { $sum: 1 } } },
            { $sort: { views: -1 } },
            { $limit: 7 }
        ]),

        // Peak months (1=Jan, 12=Dec)
        Events.aggregate([
            { $match: { event_on: 'store' } },
            { $group: { _id: { $month: '$createdAt' }, views: { $sum: 1 } } },
            { $sort: { views: -1 } },
            { $limit: 12 }
        ])
    ]);

    res.json({
        total_visitors: totalVisitors,
        store_visitors: storeVisitors,
        product_visitors: productVisitors,
        category_visitors: categoryVisitors,
        most_viewed_product: mostViewedProduct[0] || null,
        most_viewed_category: mostViewedCategory[0] || null,
        this_month_views: thisMonthViews,
        last_month_views: lastMonthViews,
        charts: {
            weekly: weeklyChart,
            monthly: monthlyChart,
            six_months: sixMonthChart,
            one_year: oneYearChart
        },
        views_by_region: viewsByRegion,
        views_by_city: viewsByCity,
        views_by_device: viewsByDevice,
        views_by_os: viewsByOS,
        views_by_browser: viewsByBrowser,
        peak_hours: peakHours,
        peak_days: peakDays,
        peak_months: peakMonths
    });
});