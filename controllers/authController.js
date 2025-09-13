const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Auth = require('../models/Auth');
const GuestLogin = require('../models/guestLogin');
const GuestCart = require('../models/guestCart');
const User = require('../models/User');
const crypto = require('crypto');
const Cart = require('../models/cart');
const { customAlphabet } = require('nanoid');
const { OAuth2Client } = require('google-auth-library');
const axios = require('axios');
const { applyDiscountsToCart } = require('../utils/discountHelper');
const Sessions = require('../models/userSession');
// Google OAuth client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const { createSession } = require('./sessionController');

// Helper: generate token
const generateToken = (payload, expiresIn = '1d') => {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
};

// Helper function to safely round to 2 decimal places
const roundToTwo = (num) => {
  return Math.round((num + Number.EPSILON) * 100) / 100;
};

// ENHANCED CART MERGE FUNCTION - supports both regular carts and guest carts
const mergeCarts = async (sourceCart, targetCart, sourceType = 'regular') => {
  try {
    // Create a map of product IDs in the target cart for quick lookup
    const targetProductMap = new Map();
    targetCart.products.forEach(item => {
      const key = item.product_id ? item.product_id.toString() : item.productId?.toString();
      if (key) targetProductMap.set(key, item);
    });
    
    // Merge source cart products into target cart
    sourceCart.products.forEach(sourceItem => {
      const productId = sourceItem.product_id ? 
        sourceItem.product_id.toString() : 
        sourceItem.productId?.toString();
      
      if (!productId) return; // Skip invalid items
      
      if (targetProductMap.has(productId)) {
        // Product exists in both carts - update quantity and preserve best pricing
        const targetItem = targetProductMap.get(productId);
        const newQuantity = targetItem.quantity + sourceItem.quantity;
        
        // Keep the better price (lower finalPrice or price)
        const sourceFinalPrice = sourceItem.finalPrice || sourceItem.price || 0;
        const targetFinalPrice = targetItem.finalPrice || targetItem.price || 0;
        
        targetItem.quantity = newQuantity;
        if (sourceFinalPrice < targetFinalPrice && sourceFinalPrice > 0) {
          targetItem.price = sourceItem.price || targetItem.price;
          targetItem.finalPrice = sourceItem.finalPrice || targetItem.finalPrice;
          targetItem.discountAmount = sourceItem.discountAmount || targetItem.discountAmount;
          targetItem.discountApplied = sourceItem.discountApplied || targetItem.discountApplied;
          targetItem.appliedDiscount = sourceItem.appliedDiscount || targetItem.appliedDiscount;
        }
        
        // Update product metadata
        if (sourceItem.product_image && !targetItem.product_image) {
          targetItem.product_image = sourceItem.product_image;
        }
        if (sourceItem.product_name && !targetItem.product_name) {
          targetItem.product_name = sourceItem.product_name;
        }
      } else {
        // Product doesn't exist in target cart - add it
        const newItem = {
          product_id: productId,
          quantity: sourceItem.quantity,
          price: roundToTwo(parseFloat(sourceItem.price) || 0),
          finalPrice: roundToTwo(parseFloat(sourceItem.finalPrice) || parseFloat(sourceItem.price) || 0),
          discountAmount: roundToTwo(parseFloat(sourceItem.discountAmount) || 0),
          discountApplied: sourceItem.discountApplied || false,
          appliedDiscount: sourceItem.appliedDiscount || null,
          product_image: sourceItem.product_image || null,
          product_name: sourceItem.product_name || 'Product'
        };
        targetCart.products.push(newItem);
      }
    });
    
    // Merge subtotal adjustments (shipping, tax, etc.)
    if (sourceCart.subtotal && Array.isArray(sourceCart.subtotal)) {
      const targetSubtotalMap = new Map();
      
      // Map existing target subtotal items
      if (targetCart.subtotal && Array.isArray(targetCart.subtotal)) {
        targetCart.subtotal.forEach(item => {
          if (item.name) targetSubtotalMap.set(item.name, item);
        });
      } else {
        targetCart.subtotal = [];
      }
      
      // Add or update subtotal items from source
      sourceCart.subtotal.forEach(sourceSubtotal => {
        if (!sourceSubtotal.name) return;
        
        if (targetSubtotalMap.has(sourceSubtotal.name)) {
          // Update existing subtotal item (keep higher value)
          const targetSubtotal = targetSubtotalMap.get(sourceSubtotal.name);
          if (Math.abs(sourceSubtotal.value) > Math.abs(targetSubtotal.value)) {
            targetSubtotal.value = sourceSubtotal.value;
            if (sourceSubtotal.type) targetSubtotal.type = sourceSubtotal.type;
          }
        } else {
          // Add new subtotal item
          const newSubtotalItem = {
            name: sourceSubtotal.name,
            value: sourceSubtotal.value,
            type: sourceSubtotal.type || 'charge'
          };
          targetCart.subtotal.push(newSubtotalItem);
        }
      });
    }
    
    // Apply discounts and recalculate totals
    const cartWithDiscounts = await applyDiscountsToCart(targetCart);
    
    // Update target cart with recalculated values
    targetCart.products = cartWithDiscounts.products || targetCart.products;
    targetCart.discountInfo = cartWithDiscounts.discountInfo || {
      totalOriginalAmount: 0,
      totalFinalAmount: 0,
      totalDiscountAmount: 0,
      hasDiscounts: false,
      discountsApplied: []
    };
    
    // Calculate final total
    const productsTotal = roundToTwo(cartWithDiscounts.discountInfo?.totalFinalAmount || 0);
    const subtotalAdjustments = (targetCart.subtotal || []).reduce((acc, item) => {
      const value = parseFloat(item.value) || 0;
      return acc + (isNaN(value) ? 0 : value);
    }, 0);
    
    targetCart.total = roundToTwo(Math.max(0, productsTotal + subtotalAdjustments));
    
    // Save the merged cart
    await targetCart.save();
    
    return targetCart;
  } catch (err) {
    console.error('Cart merge error:', err);
    throw new Error(`Cart merge failed: ${err.message}`);
  }
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

exports.login = async (req, res) => {
  console.log('function invoked');
  const {
    emailOrUsername,
    password,
    device_type,
    device_name,
    device_id,
    brand,
    model,
    cart_code,
    session_id,
    onesignal_id,
    ip_address
  } = req.body;

  try {
    // 1️⃣ Find in Auth collection
    const authUser = await Auth.findOne({
      $or: [{ username: emailOrUsername }, { email: emailOrUsername }]
    });

    if (!authUser) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // 2️⃣ Validate password
    const isMatch = await bcrypt.compare(password, authUser.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // 3️⃣ Fetch User profile (excluding sensitive stuff if needed)
    const userProfile = await User.findOne({ username: authUser.username }).select("-saved_cards.cvv");

    // 4️⃣ Ensure user cart exists
    let userCart = await Cart.findOne({ username: authUser.username });
    if (!userCart) {
      const nanoid = customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 10);
      const newCartCode = nanoid();
      userCart = await Cart.create({
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

    // 5️⃣ Handle cart merging (guest/session/direct)
    let guestCartToMerge = null;

    if (device_id && cart_code) {
      const guest = await GuestLogin.findOne({ device_id, cart_code });
      if (guest) {
        guestCartToMerge = await Cart.findOne({ username: guest.username });
        if (guestCartToMerge && guestCartToMerge.products.length > 0) {
          userCart = await mergeCarts(guestCartToMerge, userCart, "regular");
        }
        await Cart.deleteOne({ username: guest.username });
        await GuestLogin.deleteOne({ device_id, cart_code });
      }
    }

    if (session_id && !guestCartToMerge) {
      const sessionCart = await GuestCart.findOne({ session_id });
      if (sessionCart && sessionCart.products.length > 0) {
        userCart = await mergeCarts(sessionCart, userCart, "guest");
        await GuestCart.deleteOne({ session_id });
      }
    }

    if (cart_code && !guestCartToMerge) {
      const directCart = await Cart.findOne({ cart_code });
      if (directCart && directCart.username.startsWith("guest_") && directCart.products.length > 0) {
        userCart = await mergeCarts(directCart, userCart, "regular");
        await Cart.deleteOne({ cart_code });
      }
    }

    // 6️⃣ Generate JWT
    const token = jwt.sign(
      { id: authUser._id, username: authUser.username, email: authUser.email },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    // 7️⃣ Save session
    await createSession({
      token,
      device_type: device_type || "DESKTOP",
      device_name: device_name || "Unknown Device",
      user_agent: req.headers["user-agent"],
      userId: authUser._id,
      onesignal_id,
      ip_address
    });

    // 8️⃣ Return combined response (Auth + User profile, no password)
    const { password: _, ...authSafe } = authUser.toObject();

    res.status(200).json({
      token,
      auth: authSafe,
      profile: userProfile,
      cart: userCart,
      message: guestCartToMerge
        ? "Login successful - carts merged"
        : "Login successful"
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: err.message });
  }
};

// ENHANCED SOCIAL LOGIN TO HANDLE MULTIPLE CART SCENARIOS
exports.socialLogin = async (req, res) => {
  const { provider, token, device_id, brand, model, cart_code, session_id } = req.body;

  try {
    let userData;

    if (provider === 'google') {
      const ticket = await googleClient.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      userData = { email: payload.email, full_name: payload.name };
    } else if (provider === 'facebook') {
      const fbRes = await axios.get(
        `https://graph.facebook.com/me?fields=id,name,email&access_token=${token}`
      );
      userData = { email: fbRes.data.email, full_name: fbRes.data.name };
    } else {
      return res.status(400).json({ message: 'Unsupported provider' });
    }

    let authUser = await Auth.findOne({ email: userData.email });
    let isNewUser = false;

    // Create new user if doesn't exist
    if (!authUser) {
      isNewUser = true;
      const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 8);
      const username = `${userData.full_name.split(" ")[0].toLowerCase()}_${nanoid()}`;
      
      authUser = await Auth.create({
        username,
        email: userData.email,
        password: crypto.randomBytes(20).toString('hex'),
        user_type: 'user',
      });

      await User.create({
        username,
        email: userData.email,
        full_name: userData.full_name,
        addresses: [],
      });
    }

    let userCart = await Cart.findOne({ username: authUser.username });
    
    // Create user cart if it doesn't exist
    if (!userCart) {
      const nanoid = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 10);
      const newCartCode = nanoid();

      userCart = await Cart.create({
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

    // Handle guest cart merging (same logic as regular login)
    let guestCartToMerge = null;
    
    // Scenario 1: Guest login conversion
    if (device_id && cart_code) {
      const guest = await GuestLogin.findOne({ device_id, cart_code });
      if (guest) {
        guestCartToMerge = await Cart.findOne({ username: guest.username });
        
        if (guestCartToMerge && guestCartToMerge.products.length > 0) {
          userCart = await mergeCarts(guestCartToMerge, userCart, 'regular');
          console.log('Merged guest login cart with social login user cart');
        }
        
        await Cart.deleteOne({ username: guest.username });
        await GuestLogin.deleteOne({ device_id, cart_code });
      }
    }
    
    // Scenario 2: Browser session cart
    if (session_id && !guestCartToMerge) {
      const sessionCart = await GuestCart.findOne({ session_id });
      if (sessionCart && sessionCart.products.length > 0) {
        userCart = await mergeCarts(sessionCart, userCart, 'guest');
        console.log('Merged session guest cart with social login user cart');
        
        await GuestCart.deleteOne({ session_id });
      }
    }

    // Generate JWT token
    const jwtToken = jwt.sign(
      { id: authUser._id, username: authUser.username, email: authUser.email },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.status(200).json({ 
      token: jwtToken, 
      username: authUser.username, 
      cart: userCart,
      isNewUser,
      message: guestCartToMerge ? 'Social login successful - carts merged' : 'Social login successful'
    });
  } catch (err) {
    console.error('Social login error:', err);
    res.status(500).json({ message: 'Social login failed', error: err.message });
  }
};

// ENHANCED REGISTER WITH CART CREATION
exports.register = async (req, res) => {
  const { email, password, full_name, addresses, user_type, cart_code, session_id } = req.body;

  try {
    // Check if email already exists
    const existing = await Auth.findOne({ email });
    if (existing) return res.status(400).json({ message: 'User already exists with this email' });

    // Auto-generate username
    const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 6);
    let username = `user_${nanoid()}`;

    // Ensure username is unique
    while (await Auth.findOne({ username })) {
      username = `${nanoid()}`;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create in Auth
    const authUser = await Auth.create({ 
      username, 
      email, 
      password: hashedPassword, 
      user_type: user_type || 'user' 
    });

    // Create in User profile
    await User.create({ 
      username, 
      email, 
      full_name, 
      addresses: addresses || [] 
    });

    // Create user cart
    const cartNanoid = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 10);
    const newCartCode = cartNanoid();

    let userCart = await Cart.create({
      cart_code: newCartCode,
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

    // Handle guest cart merging during registration
    if (cart_code) {
      const guestCart = await Cart.findOne({ cart_code });
      if (guestCart && guestCart.username.startsWith('guest_') && guestCart.products.length > 0) {
        userCart = await mergeCarts(guestCart, userCart, 'regular');
        await Cart.deleteOne({ cart_code });
        console.log('Merged guest cart during registration');
      }
    }
    
    if (session_id) {
      const sessionCart = await GuestCart.findOne({ session_id });
      if (sessionCart && sessionCart.products.length > 0) {
        userCart = await mergeCarts(sessionCart, userCart, 'guest');
        await GuestCart.deleteOne({ session_id });
        console.log('Merged session cart during registration');
      }
    }

    // JWT token
    const token = jwt.sign(
      { id: authUser._id, username, email },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.status(201).json({ 
      token, 
      username, 
      cart: userCart,
      message: 'Registration successful'
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ message: err.message });
  }
};

// Existing functions remain the same
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findOne({ username: req.user.username }).select('-_id -__v');
    if (!user) return res.status(404).json({ message: 'Profile not found' });
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await Auth.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const resetToken = crypto.randomBytes(20).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpire = Date.now() + 15 * 60 * 1000;
    await user.save({ validateBeforeSave: false });

    console.log('Reset token (send to user):', resetToken);
    console.log('Hashed token stored in DB:', hashedToken);

    res.status(200).json({ message: 'Password reset token generated', resetToken });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.resetPassword = async (req, res) => {
  const { token } = req.params;
  const { newPassword } = req.body;
  try {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await Auth.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Token is invalid or expired' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.status(200).json({ message: 'Password reset successful' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.refreshSession = async (req, res) => {
  try {
    const user = await Auth.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const token = generateToken({ id: user._id, username: user.username });
    res.status(200).json({ token });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};