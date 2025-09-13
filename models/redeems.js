const mongoose = require('mongoose');

const ReedemSchema = new mongoose.Schema({
    reedemable_code: { type: String, required: true, unique: true }, // each code unique
    required_points: { type: Number, required: true },
    value: { type: Number }
}, { timestamps: true });

module.exports = mongoose.model('Reedem', ReedemSchema);