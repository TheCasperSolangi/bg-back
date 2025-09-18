const mongoose = require('mongoose');

const SavedCardSchema = new mongoose.Schema(
  {
    card_code: {type:String, required: true},
    card_number: { type: String, required: true },
    expiry: { type: String, required: true },
    cvv: { type: String, required: true },
    cardholder_name: { type: String }
  },
  { _id: false } // prevents subdoc _id clutter
);

const AddressSchema = new mongoose.Schema(
  {
    _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
    field: { type: String, required: true }, // e.g., home, office
    address1: { type: String, required: true },
    address2: { type: String },
    country: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    postal_code: { type: Number, required: true },
    full_address: { type: String } // computed field
  },
  { _id: false }
);

AddressSchema.pre('save', function (next) {
  // Compute full_address before saving
  this.full_address = `${this.address1}, ${this.address2 ? this.address2 + ', ' : ''}${this.city}, ${this.state}, ${this.country} - ${this.postal_code}`;
  next();
});

const UserSchema = new mongoose.Schema({
  username:  { type: String, unique: true, required: true },
  email:     { type: String, unique: true, required: true },
  full_name: { type: String, required: true },

  addresses: {
    type: [AddressSchema],
    default: []
  },
  saved_cards: {
    type: [SavedCardSchema],
    default: []
  },
  reward_points: {type:Number},
  profile_picture: { type: String },
  wallet_balance: { type: Number, default: 0 },
  language: { type: String },
  currency: { type: String },
  timezone: { type: String },
  is_verified: { type: Boolean, default: false },
  is_phone_verified: {type:String},
  verified_at: {type:String},
  phone_verified_at: {type:String},
  birthday: {type:String},
  gender: {type:String},
  phone: {type:String},
  accept_marketing: {type:Boolean, default: false},
  notification_preferences: {
    type: [String],
    enum: ["EMAIL", "PUSH_NOTIFICATIONS", "IN_APP_NOTIFICATIONS"],
    default: ["EMAIL"]
  }
});

module.exports = mongoose.models.User || mongoose.model('User', UserSchema);