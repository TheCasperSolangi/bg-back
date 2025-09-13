const express = require('express');
const router = express.Router();
const {
  createSlot,
  fetchAvailableSlots,
  getAllSlots,
  createBooking,
  fetchMyBookings,
  cancelBooking
} = require('../controllers/bookingController');

// Example middlewares (adjust based on your project)
const { authMiddleware, adminMiddleware, protect } = require('../middleware/authMiddleware');


// -------------------------
// Slot Management (Admin)
// -------------------------

// Create a new slot (Admin only)
router.post('/slots',  createSlot);

// Get all slots (Admin only)
router.get('/slots',  getAllSlots);

// -------------------------
// Slot Availability (Users)
// -------------------------

// Get available slots for a given date (Anyone)
router.get('/slots/available', fetchAvailableSlots);

// -------------------------
// Booking Management
// -------------------------

// Create a booking for a slot (User)
router.post('/:username', createBooking);

// Fetch my bookings (User)
router.get('/my', protect, fetchMyBookings);

// Cancel a booking (Admin only)
router.post('/cancel', cancelBooking);

module.exports = router;