const Slots = require('../models/slots');
const Appointments = require('../models/appointments');

// Create a new slot (Admin only)
const createSlot = async (req, res) => {
  try {
    const { slot_code, slot_name, runtime, max_bookings, start_time, date } = req.body;

    const existingSlot = await Slots.findOne({ slot_code, date });
    if (existingSlot) {
      return res.status(400).json({ message: 'Slot already exists for this date' });
    }

    const endHour = parseInt(start_time.split(':')[0]) + Math.floor(runtime / 60);
    const endMin = parseInt(start_time.split(':')[1]) + (runtime % 60);
    const endHourFinal = endHour + Math.floor(endMin / 60);
    const endMinFinal = endMin % 60;
    const end_time = `${endHourFinal.toString().padStart(2, '0')}:${endMinFinal.toString().padStart(2, '0')}:00`;

    const slot = await Slots.create({
      slot_code,
      slot_name,
      runtime,
      max_bookings,
      current_bookings: 0,
      start_time,
      end_time,
      date
    });

    res.status(201).json(slot);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const fetchAvailableSlots = async (req, res) => {
  try {
    // Priority: query → body → params
    const date = req.query.date || req.body.date || req.params.date;
    if (!date) {
      return res.status(400).json({ message: "Date is required (format: YYYY-MM-DD)" });
    }

    console.log("Looking for slots with date:", date);

    const slots = await Slots.find({ date: date });
    const availableSlots = slots.filter(slot => slot.current_bookings < slot.max_bookings);

    res.json(availableSlots);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
// Fetch all slots (Admin only)
const getAllSlots = async (req, res) => {
  try {
    const slots = await Slots.find();
    res.json(slots);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Create a booking
const createBooking = async (req, res) => {
  try {
    const { slot_code } = req.body;
    const username = req.params.username;

    const slot = await Slots.findOne({ slot_code });
    if (!slot) return res.status(404).json({ message: 'Slot not found' });
    if (slot.current_bookings >= slot.max_bookings) {
      return res.status(400).json({ message: 'Slot is fully booked' });
    }

    const appointment_code = 'APPT-' + Date.now();

    const appointment = await Appointments.create({
      appointment_code,
      slot_code,
      username,
      status: 'SCHEDULED'
    });

    slot.current_bookings += 1;
    await slot.save();

    res.status(201).json(appointment);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const fetchMyBookings = async (req, res) => {
  try {
    const username = req.user.username;
    const bookings = await Appointments.find({ username });

    // Fetch slot details and merge into each booking
    const bookingsWithSlotInfo = await Promise.all(
      bookings.map(async (booking) => {
        const slot = await Slots.findOne({ slot_code: booking.slot_code });
        return {
          appointment_code: booking.appointment_code,
          slot_code: booking.slot_code,
          username: booking.username,
          status: booking.status,
          cancellation_reason: booking.cancellation_reason || null,
          reschedule_slot_code: booking.reschedule_slot_code || null,
          // Add slot fields directly
          runtime: slot?.runtime || null,
          start_time: slot?.start_time || null,
          end_time: slot?.end_time || null,
          date: slot?.date || null
        };
      })
    );

    res.json(bookingsWithSlotInfo);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Cancel a booking (Admin only)
const cancelBooking = async (req, res) => {
  try {
    const { appointment_code, cancellation_reason } = req.body;

    const appointment = await Appointments.findOne({ appointment_code });
    if (!appointment) return res.status(404).json({ message: 'Booking not found' });

    if (appointment.status === 'CANCELLED') {
      return res.status(400).json({ message: 'Booking is already cancelled' });
    }

    appointment.status = 'CANCELLED';
    appointment.cancellation_reason = cancellation_reason;
    await appointment.save();

    // Reduce the current bookings count in the slot
    const slot = await Slots.findOne({ slot_code: appointment.slot_code });
    if (slot && slot.current_bookings > 0) {
      slot.current_bookings -= 1;
      await slot.save();
    }

    res.json({ message: 'Booking cancelled successfully', appointment });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  createSlot,
  fetchAvailableSlots,
  getAllSlots,
  createBooking,
  fetchMyBookings,
  cancelBooking
};