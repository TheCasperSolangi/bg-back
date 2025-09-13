const express = require('express');
const router = express.Router();
const {
    getAllTransactions,
    getTransactionById,
    getTransactionsByUsername,
    updateTransactionStatus,
} = require('../controllers/transactionController');

// Fetch all
router.get('/', getAllTransactions);

// Fetch by MongoDB _id
router.get('/:transaction_id', getTransactionById);

// Fetch by username
router.get('/user/:username', getTransactionsByUsername);
// Update status only
router.patch('/:id/status', updateTransactionStatus);

module.exports = router;