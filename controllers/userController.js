const User = require('../models/User');
const Auth = require('../models/Auth'); // Import Auth model
const { nanoid, customAlphabet } = require('nanoid');
const StoreSettings = require('../models/storeSettings');
// GET /api/users - Admin only: get all users
exports.getAllUsers = async (req, res) => {
  try {
    // Get all users
    const users = await User.find().select('-saved_cards.cvv');

    // Get matching auth records
    const usernames = users.map(u => u.username);
    const authRecords = await Auth.find({ username: { $in: usernames } })
      .select('username user_type');

    // Merge user_type into users
    const usersWithType = users.map(user => {
      const auth = authRecords.find(a => a.username === user.username);
      return {
        ...user.toObject(),
        user_type: auth ? auth.user_type : null
      };
    });

    res.json(usersWithType);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/users/:username - Admin or self: get user by username
exports.getUserByUsername = async (req, res) => {
  try {
    const { username } = req.params;

    if (req.user.user_type !== 'admin' && req.user.username !== username) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const user = await User.findOne({ username }).select('-saved_cards.cvv');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const auth = await Auth.findOne({ username }).select('user_type');
    const userWithType = {
      ...user.toObject(),
      user_type: auth ? auth.user_type : null
    };

    res.json(userWithType);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/users - Admin only: create user
exports.createUser = async (req, res) => {
  try {
    const { username, email, full_name, addresses, saved_cards, profile_picture } = req.body;

    const userExists = await User.findOne({ $or: [{ username }, { email }] });
    if (userExists) return res.status(400).json({ message: 'Username or email already exists' });

    const user = new User({ username, email, full_name, addresses, saved_cards, profile_picture });
    await user.save();

    res.status(201).json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/users/:username - Admin or self: update user
exports.updateUser = async (req, res) => {
  try {
    const { username } = req.params;

    if (req.user.user_type !== 'admin' && req.user.username !== username) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const updates = { ...req.body };

    // Prevent wallet_balance changes via this route
    if (updates.wallet_balance !== undefined) {
      return res.status(400).json({ message: 'Not Allowed to Update Wallet Balance please contact administrator' });
    }

    // Prevent verification-related fields from being updated
    const restrictedFields = [
      "is_verified",
      "is_phone_verified",
      "verified_at",
      "phone_verified_at"
    ];
    for (const field of restrictedFields) {
      if (updates[field] !== undefined) {
        return res.status(400).json({ message: `Not allowed to update ${field}` });
      }
    }

    // Prevent username/email conflicts
    if (updates.username || updates.email) {
      const conflict = await User.findOne({
        $or: [
          { username: updates.username },
          { email: updates.email }
        ],
        _id: { $ne: req.user._id }
      });
      if (conflict) {
        return res.status(400).json({ message: 'Username or email already taken' });
      }
    }

    const updatedUser = await User.findOneAndUpdate(
      { username },
      updates,
      { new: true, runValidators: true }
    ).select('-saved_cards.cvv');

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(updatedUser);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};


// DELETE /api/users/:username - Admin only: delete user
exports.deleteUser = async (req, res) => {
  try {
    const { username } = req.params;

    const deletedUser = await User.findOneAndDelete({ username });
    if (!deletedUser) return res.status(404).json({ message: 'User not found' });

    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/users/:username/credit
exports.creditBalance = async (req, res) => {
  try {
    const { username } = req.params;
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Amount must be greater than 0' });
    }

   

    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.wallet_balance = (user.wallet_balance || 0) + amount;
    await user.save();

    res.json({ username: user.username, wallet_balance: user.wallet_balance });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/users/:username/debit
exports.debitBalance = async (req, res) => {
  try {
    const { username } = req.params;
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Amount must be greater than 0' });
    }

    // Only admin can debit someone else's wallet
    if (req.user.user_type !== 'admin' && req.user.username !== username) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ message: 'User not found' });

    if ((user.wallet_balance || 0) < amount) {
      return res.status(400).json({ message: 'Insufficient wallet balance' });
    }

    user.wallet_balance -= amount;
    await user.save();

    res.json({ username: user.username, wallet_balance: user.wallet_balance });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/users/:username/wallet - Admin or self: get user wallet balance
exports.fetchUserWalletBalance = async (req, res) => {
  try {
    const { username } = req.params;

   

    // Find the user
    const user = await User.findOne({ username }).select('wallet_balance');
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({ username: user.username, wallet_balance: user.wallet_balance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// =======================
// Address CRUD
// =======================

// GET /api/users/:username/addresses
exports.getAddresses = async (req, res) => {
  try {
    const { username } = req.params;
    const user = await User.findOne({ username }).select('addresses');
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Map addresses to ensure full_address is always included
    const addressesWithFull = user.addresses.map(addr => ({
      _id: addr._id,
      field: addr.field,
      address1: addr.address1,
      address2: addr.address2,
      country: addr.country,
      city: addr.city,
      state: addr.state,
      postal_code: addr.postal_code,
      full_address: `${addr.address1}, ${addr.address2 ? addr.address2 + ', ' : ''}${addr.city}, ${addr.state}, ${addr.country} - ${addr.postal_code}`
    }));

    res.json(addressesWithFull);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};


// ADD new address
exports.addAddress = async (req, res) => {
  try {
    const { username } = req.params;
    const { field, address1, address2, country, city, state, postal_code } = req.body;

    if (!field || !address1 || !country || !city || !state || !postal_code) {
      return res.status(400).json({ message: 'Required fields missing' });
    }

    const newAddress = {
      field,
      address1,
      address2,
      country,
      city,
      state,
      postal_code
    };

    const user = await User.findOneAndUpdate(
      { username },
      { $push: { addresses: newAddress } },
      { new: true }
    ).select('addresses');

    if (!user) return res.status(404).json({ message: 'User not found' });

    res.status(201).json(user.addresses);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// UPDATE existing address by index
exports.updateAddress = async (req, res) => {
  try {
    const { username, index } = req.params;
    const { field, address1, address2, country, city, state, postal_code } = req.body;

    if (!field || !address1 || !country || !city || !state || !postal_code) {
      return res.status(400).json({ message: 'Required fields missing' });
    }

    const user = await User.findOne({ username }).select('addresses');
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!user.addresses[index]) {
      return res.status(404).json({ message: 'Address not found' });
    }

    user.addresses[index] = {
      field,
      address1,
      address2,
      country,
      city,
      state,
      postal_code,
      full_address: `${address1}, ${address2 ? address2 + ', ' : ''}${city}, ${state}, ${country} - ${postal_code}`
    };

    await user.save();
    res.json(user.addresses);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// DELETE /api/users/:username/addresses/:index
exports.deleteAddress = async (req, res) => {
  try {
    const { username, index } = req.params;

    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!user.addresses[index]) {
      return res.status(404).json({ message: 'Address not found' });
    }

    user.addresses.splice(index, 1);
    await user.save();

    res.json(user.addresses);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// =======================
// Payment Method CRUD
// =======================

exports.getPaymentMethods = async (req, res) => {
  try {
    const { username } = req.params;
    const user = await User.findOne({ username }).select('saved_cards');
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    // Return cards without CVV for security
    const cardsWithoutCVV = user.saved_cards.map(card => ({
      card_code: card.card_code,
      _id: card._id,
      card_number: card.card_number,
      expiry: card.expiry,
      cardholder_name: card.cardholder_name
    }));
    
    res.json(cardsWithoutCVV);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.addPaymentMethod = async (req, res) => {
  try {
    const nanoid = customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*(*_")
    const card_code = `CARD-${nanoid()}`
    const { username } = req.params;
    const { card_number, expiry, cvv, cardholder_name } = req.body;

    if (!card_number || !expiry || !cvv || !cardholder_name) {
      return res.status(400).json({ message: 'All card fields are required' });
    }

    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Add new card
    user.saved_cards.push({ card_number, expiry, cvv, cardholder_name, card_code: card_code });
    await user.save();

    // Return updated list without CVV
    const cardsWithoutCVV = user.saved_cards.map(card => ({
      card_code: card.card_code,
      _id: card._id,
      card_number: card.card_number,
      expiry: card.expiry,
      cardholder_name: card.cardholder_name
    }));

    res.status(201).json(cardsWithoutCVV);
  } catch (err) {
    res.status(500).json({ message: 'Server error', err});
  }
};

exports.updatePaymentMethod = async (req, res) => {
  try {
    const { username, card_code } = req.params;
    const updates = req.body;

    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Find the card in the saved_cards array
    const card = user.saved_cards.find(card => card.card_code === card_code);
    if (!card) return res.status(404).json({ message: 'Card not found' });

    // Update only allowed fields (exclude sensitive fields if needed)
    Object.keys(updates).forEach(key => {
      if (key !== 'cvv' || req.body.cvv) { // Only update CVV if explicitly provided
        card[key] = updates[key];
      }
    });

    await user.save();

    // Return updated list without CVV
    const cardsWithoutCVV = user.saved_cards.map(card => ({
      card_code: card.card_code, // Fixed typo: cart_code -> card_code
      _id: card._id,
      card_number: card.card_number,
      expiry: card.expiry,
      cardholder_name: card.cardholder_name
    }));

    res.json(cardsWithoutCVV);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
// DELETE /api/users/:username/payment-methods/:cardId
// DELETE /api/users/:username/payment-methods/:card_code
exports.deletePaymentMethod = async (req, res) => {
  try {
    const { username, card_code } = req.params;

    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Find the index of the card with the matching card_code
    const cardIndex = user.saved_cards.findIndex(card => card.card_code === card_code);
    if (cardIndex === -1) return res.status(404).json({ message: 'Card not found' });

    // Remove the card from the array
    user.saved_cards.splice(cardIndex, 1);
    await user.save();

    // Return updated list without sensitive data
    res.json(user.saved_cards.map(c => ({ 
      card_code: c.card_code,
      _id: c._id, 
      card_number: c.card_number, 
      expiry: c.expiry, 
      cardholder_name: c.cardholder_name 
    })));
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// POST /api/users/:username/redeem
exports.redeemRewardPoints = async (req, res) => {
  try {
    const { username } = req.params;
    const { amount } = req.body; // reward points user wants to redeem

    // Only admin or self can redeem
    if (req.user.user_type !== 'admin' && req.user.username !== username) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Load store settings to get conversion ratio
    const storeSettings = await StoreSettings.findOne().sort({ createdAt: -1 });
    if (!storeSettings || !storeSettings.minimum_points) {
      return res.status(500).json({ message: 'Reward settings not configured' });
    }

    const minimumPoints = storeSettings.minimum_points; 
    if (!minimumPoints || minimumPoints <= 0) {
      return res.status(400).json({ message: 'Invalid reward point conversion setting' });
    }

    // Validate input amount
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Please provide a valid reward points amount to redeem.' });
    }

    if (amount > user.reward_points) {
      return res.status(400).json({ message: `You only have ${user.reward_points} reward points.` });
    }

    if (amount < minimumPoints) {
      return res.status(400).json({ message: `You must redeem at least ${minimumPoints} reward points.` });
    }

    // Amount must be multiple of minimumPoints
    if (amount % minimumPoints !== 0) {
      return res.status(400).json({ message: `Redeem amount must be a multiple of ${minimumPoints} reward points.` });
    }

    // Convert reward points → wallet balance
    const currencyAmount = amount / minimumPoints;

    user.reward_points -= amount;
    user.wallet_balance = (user.wallet_balance || 0) + currencyAmount;

    await user.save();

    res.json({
      message: `Successfully redeemed ${amount} points for ${currencyAmount} ${user.currency || 'currency'}`,
      username: user.username,
      wallet_balance: user.wallet_balance,
      remaining_points: user.reward_points
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
