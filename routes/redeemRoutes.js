const express = require("express");
const {
  createReedem,
  getReedems,
  getReedem,
  updateReedem,
  deleteReedem
} = require("../controllers/redeemController");
const {protect, authorizeRoles} = require('../middleware/authMiddleware');

const router = express.Router();

// CRUD routes
router.post("/", createReedem);     // Create
router.get("/", protect, getReedems);        // Fetch all
router.get("/:id", getReedem);      // Fetch single
router.put("/:id", updateReedem);   // Update
router.delete("/:id", deleteReedem); // Delete

module.exports = router;