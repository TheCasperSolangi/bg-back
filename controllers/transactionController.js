const Transaction = require('../models/transactions');
const asyncHandler = require('../utils/asyncHandler');

// @desc    Get all transactions
// @route   GET /api/transactions
// @access  Public/Admin (depends on your auth middleware)
exports.getAllTransactions = asyncHandler(async (req, res) => {
    const transactions = await Transaction.find().sort({ createdAt: -1 });
    res.json({ success: true, count: transactions.length, data: transactions });
});

// @desc    Get single transaction by ID
// @route   GET /api/transactions/:id
// @access  Public/Admin
exports.getTransactionById = asyncHandler(async (req, res) => {
    const transaction = await Transaction.findOne({transaction_id: req.params.transaction_id})

    if (!transaction) {
        return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    res.json({ success: true, data: transaction });
});

// @desc    Get transactions by username
// @route   GET /api/transactions/user/:username
// @access  Public
exports.getTransactionsByUsername = asyncHandler(async (req, res) => {
    const transactions = await Transaction.find({ username: req.params.username }).sort({ createdAt: -1 });

    res.json({ success: true, count: transactions.length, data: transactions });
});
// @desc    Update transaction status
// @route   PATCH /api/transactions/:id/status
// @access  Admin (or whoever is authorized)
exports.updateTransactionStatus = asyncHandler(async (req, res) => {
    const { status } = req.body;

    // Ensure valid enum
    const validStatuses = ['PENDING', 'CANCELLED', 'COMPLETE'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status value' });
    }

    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) {
        return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    transaction.status = status;
    await transaction.save();

    res.json({ success: true, message: 'Transaction status updated', data: transaction });
});