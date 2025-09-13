const LedgerBook = require("../models/ledger_schema");
const LedgerTransactions = require('../models/ledger_transaction');
const { customAlphabet, nanoid } = require('nanoid');
// Create new ledger entry
exports.createLedger = async (req, res) => {
  try {
    const ledger = new LedgerBook(req.body);
    await ledger.save();
    res.status(201).json({ success: true, data: ledger });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Get all ledger entries
exports.getLedgers = async (req, res) => {
  try {
    const ledgers = await LedgerBook.find().sort({ expected_due_date: 1 });
    res.status(200).json({ success: true, data: ledgers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get single ledger entry by ID
exports.getLedgerById = async (req, res) => {
  try {
    const ledger = await LedgerBook.findById(req.params.id);
    if (!ledger) {
      return res.status(404).json({ success: false, message: "Ledger not found" });
    }
    res.status(200).json({ success: true, data: ledger });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update ledger entry
exports.updateLedger = async (req, res) => {
  try {
    const ledger = await LedgerBook.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!ledger) {
      return res.status(404).json({ success: false, message: "Ledger not found" });
    }
    res.status(200).json({ success: true, data: ledger });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Delete ledger entry
exports.deleteLedger = async (req, res) => {
  try {
    const ledger = await LedgerBook.findByIdAndDelete(req.params.id);
    if (!ledger) {
      return res.status(404).json({ success: false, message: "Ledger not found" });
    }
    res.status(200).json({ success: true, message: "Ledger deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Mark ledger as paid
exports.markAsPaid = async (req, res) => {
  try {
    const ledger = await LedgerBook.findById(req.params.id);

    if (!ledger) {
      return res.status(404).json({ success: false, message: "Ledger not found" });
    }

    ledger.is_paid = true;
    ledger.paid_on = new Date().toISOString();
    await ledger.save();
    
    // Creating Transaction for Ledger 
    const transaction_id = `TRX-${nanoid(12)}`
    const newTransaction = await LedgerTransactions.create({
        transaction_id: transaction_id,
        full_name: ledger.full_name,
        mobile_number: ledger.mobile_number,
        amount_paid: ledger.amount_due,
        paid_with: "CASH",

    })
    res.status(200).json({ success: true, data: ledger, transaction_summary: newTransaction });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


exports.getLedgerByCustomer = async (req, res) => {
  try {
    const { mobile_number } = req.params;

    // Fetch ledgers for this customer, sorted by expected_due_date ascending
    const ledgers = await LedgerBook.find({ mobile_number }).sort({ expected_due_date: 1 });

    if (!ledgers || ledgers.length === 0) {
      return res.status(404).json({ success: false, message: "No ledger entries found for this customer" });
    }

    let total = 0;
    let paid = 0;
    let outstanding_balance = 0;
    const missed_due_ledgers = [];
    let nearest_due_ledger = null;

    const now = new Date();
    let credit_score = 100; // Start with perfect score

    ledgers.forEach(ledger => {
      total += ledger.amount_due;

      if (ledger.is_paid) {
        paid += ledger.amount_due;
      } else {
        outstanding_balance += ledger.amount_due;

        // Missed due ledgers
        const dueDate = new Date(ledger.expected_due_date);
        if (dueDate < now) {
          missed_due_ledgers.push(ledger);

          // Deduct 10 points for each missed ledger
          credit_score -= 10;

          // Optional: further deduction for overdue days
          const days_overdue = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));
          credit_score -= days_overdue; 
        } else if (!nearest_due_ledger) {
          nearest_due_ledger = ledger;
        }
      }
    });

    // Deduct based on outstanding balance (1 point per 100 units owed)
    credit_score -= Math.floor(outstanding_balance / 100);

    // Clamp the score between 0 and 100
    credit_score = Math.max(0, Math.min(100, credit_score));

    const response = {
      success: true,
      total_ledger_entries: ledgers.length,
      total,
      paid,
      outstanding_balance,
      nearest_due_ledger,
      missed_due_ledgers,
      ledgers_summary: ledgers,
      credit_score
    };

    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get a transaction by transaction_id
exports.getTransactionById = async (req, res) => {
  try {
    const { transaction_id } = req.params;

    if (!transaction_id) {
      return res.status(400).json({ success: false, message: "Transaction ID is required" });
    }

    const transaction = await LedgerTransactions.findOne({ transaction_id });

    if (!transaction) {
      return res.status(404).json({ success: false, message: "Transaction not found" });
    }

    res.status(200).json({ success: true, data: transaction });
  } catch (error) {
    console.error("Error fetching transaction:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};