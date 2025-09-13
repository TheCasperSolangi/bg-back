const express = require("express");
const router = express.Router();
const ledgerController = require("../controllers/ledger_controller");

// Create new ledger entry
router.post("/", ledgerController.createLedger);

// Get all ledger entries
router.get("/", ledgerController.getLedgers);

// Get ledger by ID
router.get("/:id", ledgerController.getLedgerById);

// Get ledger by customer mobile number
router.get("/customer/:mobile_number", ledgerController.getLedgerByCustomer);



// Update ledger entry
router.put("/:id", ledgerController.updateLedger);

// Delete ledger entry
router.delete("/:id", ledgerController.deleteLedger);

// Mark ledger as paid
router.patch("/paid/:id", ledgerController.markAsPaid);
// Example URL: /api/ledger/transaction/12345
router.get('/transactions/by-code/:transaction_id', ledgerController.getTransactionById);
module.exports = router;