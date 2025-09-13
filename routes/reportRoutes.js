// routes/reportRoutes.js
const express = require('express');
const router = express.Router();
const { getFinancialReport } = require('../controllers/financialReportController');
const { getStoreAnalytics} = require('../controllers/analyticsReports');
router.get('/store_analytics', getStoreAnalytics);
router.get('/financial_report', getFinancialReport);

module.exports = router;