// controllers/reportController.js
const Order = require('../models/order');
const Product = require('../models/product');
const User = require('../models/User');
const mongoose = require('mongoose');

exports.getFinancialReport = async (req, res) => {
  try {
    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    // Revenue this month
    const revenueThisMonth = (await Order.aggregate([
      { $match: { createdAt: { $gte: startOfThisMonth }, status: { $ne: 'cancelled' } } },
      { $group: { _id: null, total: { $sum: "$total" } } }
    ]))[0]?.total || 0;

    // Revenue last month
    const revenueLastMonth = (await Order.aggregate([
      { $match: { createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth }, status: { $ne: 'cancelled' } } },
      { $group: { _id: null, total: { $sum: "$total" } } }
    ]))[0]?.total || 0;

    // Change percentage
    const changePercentage = revenueLastMonth > 0
      ? ((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100
      : (revenueThisMonth > 0 ? 100 : 0);

    // Last 6 months revenue
    const lastSixMonthsRevenue = await Order.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo }, status: { $ne: 'cancelled' } } },
      {
        $group: {
          _id: { month: { $month: "$createdAt" }, year: { $year: "$createdAt" } },
          total: { $sum: "$total" }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    const monthlyRevenueChart = lastSixMonthsRevenue.map(m => ({
      month: `${m._id.month}-${m._id.year}`,
      revenue: m.total
    }));

    // Last 6 months loss
    const lastSixMonthsLoss = await Order.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo }, status: 'cancelled' } },
      {
        $group: {
          _id: { month: { $month: "$createdAt" }, year: { $year: "$createdAt" } },
          total: { $sum: "$total" }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    const monthlyLossChart = lastSixMonthsLoss.map(m => ({
      month: `${m._id.month}-${m._id.year}`,
      loss: m.total
    }));

    // This month loss
    const thisMonthLoss = (await Order.aggregate([
      { $match: { createdAt: { $gte: startOfThisMonth }, status: 'cancelled' } },
      { $group: { _id: null, total: { $sum: "$total" } } }
    ]))[0]?.total || 0;

    // Overall financial summary
    const overallSummaryAgg = await Order.aggregate([
      { $group: { _id: "$status", total: { $sum: "$total" }, count: { $sum: 1 } } }
    ]);
    const overallSummary = {};
    overallSummaryAgg.forEach(item => {
      overallSummary[item._id] = { total: item.total, count: item.count };
    });

    // Top 5 products (for chart)
    const topProductsAgg = await Order.aggregate([
      { $unwind: "$items" },
      { $match: { status: { $ne: 'cancelled' } } },
      {
        $group: {
          _id: "$items.product_id",
          totalSold: { $sum: "$items.quantity" }
        }
      },
      { $sort: { totalSold: -1 } },
      { $limit: 5 }
    ]);

    const topProductsChart = [];
    for (let p of topProductsAgg) {
      const product = await Product.findById(p._id, "product_name");
      if (product) {
        topProductsChart.push({
          name: product.product_name,
          totalSold: p.totalSold
        });
      }
    }

    // Order status distribution
    const orderStatusChart = overallSummaryAgg.map(s => ({
      status: s._id,
      count: s.count
    }));

    // Most selling product
    const mostSellingProductId = topProductsAgg[0]?._id;
    const mostSellingProduct = mostSellingProductId
      ? await Product.findById(mostSellingProductId, "product_name product_code")
      : null;

    // Least selling product
    const leastSellingAgg = await Order.aggregate([
      { $unwind: "$items" },
      { $match: { status: { $ne: 'cancelled' } } },
      {
        $group: {
          _id: "$items.product_id",
          totalSold: { $sum: "$items.quantity" }
        }
      },
      { $sort: { totalSold: 1 } },
      { $limit: 1 }
    ]);
    const leastSellingProductId = leastSellingAgg[0]?._id;
    const leastSellingProduct = leastSellingProductId
      ? await Product.findById(leastSellingProductId, "product_name product_code")
      : null;

    // Most cancelled product
    const mostCancelledAgg = await Order.aggregate([
      { $match: { status: 'cancelled' } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.product_id",
          cancelledCount: { $sum: "$items.quantity" }
        }
      },
      { $sort: { cancelledCount: -1 } },
      { $limit: 1 }
    ]);
    const mostCancelledProductId = mostCancelledAgg[0]?._id;
    const mostCancelledProduct = mostCancelledProductId
      ? await Product.findById(mostCancelledProductId, "product_name product_code")
      : null;

    // Cancelled orders this month
    const cancelledOrdersThisMonth = await Order.countDocuments({
      status: 'cancelled',
      createdAt: { $gte: startOfThisMonth }
    });

    // User with highest orders
    const topUserAgg = await Order.aggregate([
      { $match: { status: { $ne: 'cancelled' } } },
      {
        $group: {
          _id: "$billing_address",
          totalOrders: { $sum: 1 },
          totalSpent: { $sum: "$total" }
        }
      },
      { $sort: { totalOrders: -1 } },
      { $limit: 1 }
    ]);
    const userWithHighestOrders = topUserAgg[0] || null;

    // User with highest cancels
    const topCancelUserAgg = await Order.aggregate([
      { $match: { status: 'cancelled' } },
      {
        $group: {
          _id: "$billing_address",
          cancelledOrders: { $sum: 1 }
        }
      },
      { $sort: { cancelledOrders: -1 } },
      { $limit: 1 }
    ]);
    const userWithHighestCancels = topCancelUserAgg[0] || null;

    // 📤 Final response
    res.json({
      revenue_this_month: revenueThisMonth,
      revenue_last_month: revenueLastMonth,
      change_percentage: Math.round(changePercentage * 100) / 100,
      this_month_loss: thisMonthLoss,
      so_far_financial_summary: overallSummary,
      most_selling_product: mostSellingProduct,
      least_selling_product: leastSellingProduct,
      most_cancelled_product: mostCancelledProduct,
      cancelled_orders_this_month: cancelledOrdersThisMonth,
      user_with_highest_orders: userWithHighestOrders,
      user_with_highest_cancels: userWithHighestCancels,
      charts: {
        monthlyRevenue: monthlyRevenueChart,
        monthlyLoss: monthlyLossChart,
        topProducts: topProductsChart,
        orderStatusDistribution: orderStatusChart
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};