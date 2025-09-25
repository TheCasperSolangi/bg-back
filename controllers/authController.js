const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Auth = require('../models/Auth');
const GuestLogin = require('../models/guestLogin'); // Import the Guest model
const User = require('../models/User');
const crypto = require('crypto');
const Cart = require('../models/cart');
const { customAlphabet } = require('nanoid');
const { OAuth2Client } = require('google-auth-library');
const axios = require('axios');
const Sessions = require('../models/userSession');
// Google OAuth client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const { createSession } = require('./sessionController');

// Helper: generate token
const generateToken = (payload, expiresIn = '1d') => {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
};



// SIMPLIFIED GUEST LOGIN
exports.guestLogin = async (req, res) => {
  try {
    const { device_id, brand, model, notification_id, device_type, ip_address } = req.body;

    // Generate random username + email placeholder
    const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 8);
    const username = `guest_${nanoid()}`;
    const session_id = `SES-${nanoid()}`;
    const email = `${username}@guest.local`;
    const password = `${nanoid()}-${nanoid()}-${nanoid()}`
    // Create Auth entry
    const authUser = await Auth.create({
      username,
      email,
      password: password, // random unusable password
      user_type: "guest"
    });

    // Create User profile
    await User.create({
      username,
      email,
      full_name: "Guest User",
      addresses: []
    });

    // Create empty Cart
    const cartNanoid = customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 10);
    const cartCode = cartNanoid();
    const cart = await Cart.create({
      cart_code: cartCode,
      username,
      products: [],
      subtotal: [],
      total: 0,
      discountInfo: {
        totalOriginalAmount: 0,
        totalFinalAmount: 0,
        totalDiscountAmount: 0,
        hasDiscounts: false,
        discountsApplied: []
      }
    });

    // JWT token valid for 30 days
    const token = jwt.sign(
      { id: authUser._id, username, email, user_type: "guest" },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );
    const guestUserSession = await Sessions.create({
        token: token,
        device_type: device_type,
        device_name: `${model}-${brand}`,
        user_agent: req.headers.user_agent,
        createdAt: Date.now(),
        onesignal_id: notification_id,
        ip_address: ip_address || '',
         user: authUser._id  // <-- FIXED
    })

    res.status(200).json({
      token,
      username,
      password,
      email,
      user_type: "guest",
      cart,
      device_id,
      brand,
      model,
      message: "Guest login successful",
      session_id,
      notification_id,
      guestUserSession
    });
  } catch (err) {
    console.error("Guest login error:", err);
    res.status(500).json({ message: err.message });
  }
};

// MERGE GUEST CART WITH USER CART
const mergeCarts = async (guestCart, userCart) => {
  try {
    // Create a map of product IDs in the user's cart for quick lookup
    const userProductMap = new Map();
    userCart.products.forEach(item => {
      userProductMap.set(item.productId.toString(), item);
    });
    
    // Merge guest cart products into user cart
    guestCart.products.forEach(guestItem => {
      const productId = guestItem.productId.toString();
      
      if (userProductMap.has(productId)) {
        // Product exists in both carts - update quantity
        const userItem = userProductMap.get(productId);
        userItem.quantity += guestItem.quantity;
      } else {
        // Product doesn't exist in user cart - add it
        userCart.products.push(guestItem);
      }
    });
    
    // Recalculate totals
    userCart.subtotal = userCart.products.map(item => item.price * item.quantity);
    userCart.total = userCart.subtotal.reduce((sum, amount) => sum + amount, 0);
    
    // Save the merged cart
    await userCart.save();
    
    // Delete the guest cart
    await Cart.deleteOne({ _id: guestCart._id });
    
    return userCart;
  } catch (err) {
    throw new Error(`Cart merge failed: ${err.message}`);
  }
};
// MODIFIED LOGIN FUNCTION TO HANDLE GUEST LOGIN MERGE
exports.login = async (req, res) => {
  const { emailOrUsername, password, device_type, device_name, device_id, brand, model, cart_code } = req.body;
  
  try {
    // find by username OR email
    const authUser = await Auth.findOne({
      $or: [{ username: emailOrUsername }, { email: emailOrUsername }]
    });

    if (!authUser) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, authUser.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check if this is a guest converting to regular user
    if (device_id && cart_code) {
      // Find guest record
      const guest = await GuestLogin.findOne({ 
        device_id, 
        cart_code 
      });
      
      if (guest) {
        // Find guest cart
        const guestCart = await Cart.findOne({ username: guest.username });
        
        if (guestCart) {
          // Check if user already has a cart
          let userCart = await Cart.findOne({ username: authUser.username });
          
          if (userCart) {
            // Merge guest cart with user's existing cart
            userCart = await mergeCarts(guestCart, userCart);
          } else {
            // User doesn't have a cart - assign guest cart to user
            userCart = await Cart.findOneAndUpdate(
              { username: guest.username },
              { username: authUser.username },
              { new: true }
            );
          }
          
          // Delete guest record and cart
          await GuestLogin.deleteOne({ device_id, cart_code });
        }
      }
    }
    
    // Get or create user cart (if not already handled above)
    let cart = await Cart.findOne({ username: authUser.username });
    if (!cart) {
      const nanoid = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 10);
      const newCartCode = nanoid();

      cart = await Cart.create({
        cart_code: newCartCode,
        username: authUser.username,
        products: [],
        subtotal: [],
        total: 0,
        discountInfo: {
          totalOriginalAmount: 0,
          totalFinalAmount: 0,
          totalDiscountAmount: 0,
          hasDiscounts: false,
          discountsApplied: []
        }
      });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: authUser._id, username: authUser.username, email: authUser.email },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    // Save user session
    await createSession({
      token,
      device_type: device_type || 'DESKTOP',
      device_name: device_name || 'Unknown Device',
      user_agent: req.headers['user-agent'],
      userId: authUser._id
    });

    res.status(200).json({ token, cart });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// MODIFIED SOCIAL LOGIN TO HANDLE GUEST LOGIN MERGE
exports.socialLogin = async (req, res) => {
  const { provider, token, device_id, brand, model, cart_code } = req.body;

  try {
    let userData;

    if (provider === 'google') {
      // Verify Google token
      const ticket = await googleClient.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      userData = { email: payload.email, full_name: payload.name };
    } else if (provider === 'facebook') {
      // Verify Facebook token
      const fbRes = await axios.get(
        `https://graph.facebook.com/me?fields=id,name,email&access_token=${token}`
      );
      userData = { email: fbRes.data.email, full_name: fbRes.data.name };
    } else {
      return res.status(400).json({ message: 'Unsupported provider' });
    }

    // Check if user exists
    let authUser = await Auth.findOne({ email: userData.email });

    // If not, create a new user
    if (!authUser) {
      const nanoid = customAlphabet('abcdefghijklmnopqrtsuvwxyz0123456789', 8);
      const username = `${userData.full_name.split(" ")[0].toLowerCase()}_${nanoid()}`;
      
      authUser = await Auth.create({
        username,
        email: userData.email,
        password: crypto.randomBytes(20).toString('hex'), // random password
        user_type: 'user',
      });

      await User.create({
        username,
        email: userData.email,
        full_name: userData.full_name,
        addresses: [],
      });
    }

    // Check if this is a guest converting to regular user
    if (device_id && cart_code) {
      // Find guest record
      const guest = await GuestLogin.findOne({ 
        device_id, 
        cart_code 
      });
      
      if (guest) {
        // Find guest cart
        const guestCart = await Cart.findOne({ username: guest.username });
        
        if (guestCart) {
          // Check if user already has a cart
          let userCart = await Cart.findOne({ username: authUser.username });
          
          if (userCart) {
            // Merge guest cart with user's existing cart
            userCart = await mergeCarts(guestCart, userCart);
          } else {
            // User doesn't have a cart - assign guest cart to user
            userCart = await Cart.findOneAndUpdate(
              { username: guest.username },
              { username: authUser.username },
              { new: true }
            );
          }
          
          // Delete guest record and cart
          await GuestLogin.deleteOne({ device_id, cart_code });
        }
      }
    }
    
    // Get or create user cart (if not already handled above)
    let cart = await Cart.findOne({ username: authUser.username });
    if (!cart) {
      const nanoid = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 10);
      const newCartCode = nanoid();

      cart = await Cart.create({
        cart_code: newCartCode,
        username: authUser.username,
        products: [],
        subtotal: [],
        total: 0,
        discountInfo: {
          totalOriginalAmount: 0,
          totalFinalAmount: 0,
          totalDiscountAmount: 0,
          hasDiscounts: false,
          discountsApplied: []
        }
      });
    }

    // Generate JWT token
    const jwtToken = jwt.sign(
      { id: authUser._id, username: authUser.username, email: authUser.email },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.status(200).json({ token: jwtToken, username: authUser.username, cart });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: 'Social login failed', error: err.message });
  }
};

// MODIFIED SOCIAL LOGIN TO HANDLE GUEST LOGIN MERGE
exports.socialLogin = async (req, res) => {
  const { provider, token, device_id, brand, model, cart_code } = req.body;

  try {
    let userData;

    if (provider === 'google') {
      // Verify Google token
      const ticket = await googleClient.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      userData = { email: payload.email, full_name: payload.name };
    } else if (provider === 'facebook') {
      // Verify Facebook token
      const fbRes = await axios.get(
        `https://graph.facebook.com/me?fields=id,name,email&access_token=${token}`
      );
      userData = { email: fbRes.data.email, full_name: fbRes.data.name };
    } else {
      return res.status(400).json({ message: 'Unsupported provider' });
    }

    // Check if user exists
    let authUser = await Auth.findOne({ email: userData.email });

    // If not, create a new user
    if (!authUser) {
      const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 8);
      const username = `${userData.full_name.split(" ")[0].toLowerCase()}_${nanoid()}`;
      
      authUser = await Auth.create({
        username,
        email: userData.email,
        password: crypto.randomBytes(20).toString('hex'), // random password
        user_type: 'user',
      });

      await User.create({
        username,
        email: userData.email,
        full_name: userData.full_name,
        addresses: [],
      });
    }

    // Check if this is a guest converting to regular user
    if (device_id && cart_code) {
      // Find guest cart
      const guestCart = await Cart.findOne({ cart_code });
      
      if (guestCart) {
        // Check if user already has a cart
        let userCart = await Cart.findOne({ username: authUser.username });
        
        if (userCart) {
          // Merge guest cart with user's existing cart
          userCart = await mergeCarts(guestCart, userCart);
        } else {
          // User doesn't have a cart - assign guest cart to user
          userCart = await Cart.findOneAndUpdate(
            { cart_code },
            { username: authUser.username },
            { new: true }
          );
        }
        
        // Delete guest auth and user records if they exist
        await Auth.deleteOne({ device_id, user_type: 'guest' });
        await User.deleteOne({ username: guestCart.username });
      }
    }
    
    // Get or create user cart (if not already handled above)
    let cart = await Cart.findOne({ username: authUser.username });
    if (!cart) {
      const nanoid = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 10);
      const newCartCode = nanoid();

      cart = await Cart.create({
        cart_code: newCartCode,
        username: authUser.username,
        products: [],
        subtotal: [],
        total: 0,
        discountInfo: {
          totalOriginalAmount: 0,
          totalFinalAmount: 0,
          totalDiscountAmount: 0,
          hasDiscounts: false,
          discountsApplied: []
        }
      });
    }

    // Generate JWT token
    const jwtToken = jwt.sign(
      { id: authUser._id, username: authUser.username, email: authUser.email },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.status(200).json({ token: jwtToken, username: authUser.username, cart });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: 'Social login failed', error: err.message });
  }
};

exports.register = async (req, res) => {
  const { email, password, full_name, addresses, user_type } = req.body;

  try {
    // Check if email already exists
    const existing = await Auth.findOne({ email });
    if (existing) return res.status(400).json({ message: 'User already exists with this email' });

    // Auto-generate username
    const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 8);
    let username = `${full_name.split(" ")[0].toLowerCase()}_${nanoid()}`;

    // Ensure username is unique (retry if collision)
    while (await Auth.findOne({ username })) {
      username = `${full_name.split(" ")[0].toLowerCase()}_${nanoid()}`;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create in Auth
    const authUser = await Auth.create({ username, email, password: hashedPassword, user_type });

    // Create in User profile
    const profileUser = await User.create({ username, email, full_name, addresses });

    // JWT token
    const token = jwt.sign(
      { id: authUser._id, username, email },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.status(201).json({ token, username });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findOne({ username: req.user.username }).select('-_id -__v');
    if (!user) return res.status(404).json({ message: 'Profile not found' });
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// FORGOT PASSWORD
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await Auth.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Generate token
    const resetToken = crypto.randomBytes(20).toString('hex');

    // Hash token for DB
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Save hashed token & expiry
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpire = Date.now() + 15 * 60 * 1000; // 15 mins
    await user.save({ validateBeforeSave: false });

    console.log('Reset token (send to user):', resetToken);
    console.log('Hashed token stored in DB:', hashedToken);

    res.status(200).json({ message: 'Password reset token generated', resetToken });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// RESET PASSWORD
exports.resetPassword = async (req, res) => {
  const { token } = req.params;
  const { newPassword } = req.body;
  try {
    // Hash the incoming token before comparing
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    console.log('Incoming token:', token);
    console.log('Incoming token hashed:', hashedToken);

    const user = await Auth.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Token is invalid or expired' });
    }

    // Update password & clear reset fields
    user.password = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.status(200).json({ message: 'Password reset successful' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// UPDATE SESSION (Refresh Token)
exports.refreshSession = async (req, res) => {
  try {
    const user = await Auth.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const token = generateToken({ id: user._id, username: user.username });
    res.status(200).json({ token });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }};
