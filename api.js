require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const connectDB = require('./config/db');
const cors = require('cors');
const path = require('path');
const { errorHandler } = require('./middleware/errorMiddleware');

// Routes
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const categoriesRoutes = require('./routes/categoriesRoutes');
const cartRoutes = require('./routes/cartRotues');
const orderRoutes = require('./routes/orderRoutes');
const userRoutes = require('./routes/userRoutes');
const bannerRoutes = require('./routes/bannerRoutes');
const voucherRoutes = require('./routes/voucherRoutes');
const discountRoutes = require('./routes/discountRoutes');
const liveRoutes = require('./routes/liveRoutes');
const appSettingsRoutes = require('./routes/appSettingsRoutes');
const storeSettingRoutes = require('./routes/storeSettingsRoutes');
const reportRoutes = require('./routes/reportRoutes');
const eventRoutes = require('./routes/eventRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const qnaRoutes = require('./routes/qnaRoutes');
const shippingRoutes = require('./routes/shippingRoutes');
const taxRoutes = require('./routes/taxRoutes');
const userSession = require('./routes/usersessionRoutes');
const favoriteRoutes = require('./routes/favoriteRoutes');
const bookingRoutes = require('./routes/slotsRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const paypalRoutes = require('./routes/paypalRoutes'); // Add PayPal routes
const lalamoveRoutes = require("./routes/lalamoveRoutes");
const guestORoutes = require("./routes/guestOrder");
const transactionRotues = require('./routes/transactionRoutes');
const { setupNotificationEvents } = require('./middleware/notificationMiddleware');
const ledgerRoutes = require("./routes/ledger_routes");
const reedemRoutes = require("./routes/redeemRoutes");
// Init app
const app = express();
connectDB();

// Replace your current CORS setup with this:
app.use(cors({
  origin: true, // Allow all origins
  credentials: true, // Allow credentials
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"]
}));

app.use(express.json());

// Create HTTP server + Socket.IO BEFORE using it
const server = http.createServer(app);

// Also update Socket.IO CORS:
const io = socketIo(server, {
  cors: {
    origin: "*", // Allow all origins for Socket.IO
    methods: ["GET", "POST"],
    credentials: false // Must be false when origin is *
  }
});

// Attach io to requests so it's accessible in routes/controllers
app.use((req, res, next) => {
  req.io = io;
  next();
});

// API endpoints
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/carts', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/users', userRoutes);
app.use('/api/shipping', shippingRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/vouchers', voucherRoutes);
app.use('/api/discounts', discountRoutes);
app.use('/api/live', liveRoutes);
app.use('/api/settings', appSettingsRoutes);
app.use('/api/store/settings', storeSettingRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/taxes', taxRoutes);
app.use('/api/qna', qnaRoutes);
app.use('/api/sessions', userSession);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/paypal', paypalRoutes); // Add PayPal routes
app.use("/api/lalamove", lalamoveRoutes);
app.use("/api/guest/orders", guestORoutes);
app.use("/api/guest/cart", require("./routes/guestCartRoutes"));
app.use("/api/transactions", transactionRotues);
// Ledger routes
app.use("/api/ledgers", ledgerRoutes);
// Add this before other JSON parsing middleware for webhook route
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));
app.use("/api/reedems", reedemRoutes);
// Add your regular routes
app.use('/api/stripe', require('./routes/stripeRoutes'));

// Setup Socket.IO notification events
setupNotificationEvents(io);

// Serve static frontend for live streaming
app.use(express.static(path.join(__dirname, 'public')));

// Error middleware
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));