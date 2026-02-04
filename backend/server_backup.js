// ====================================================
// EVENTFLIX BACKEND SERVER - FIXED (No reload on OTP)
// ====================================================

import express from "express";
import cors from "cors";
import axios from "axios";
import dotenv from "dotenv";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// ====================================================
// MIDDLEWARE
// ====================================================
app.use(cors({
  origin: '*',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// ====================================================
// IN-MEMORY OTP STORAGE (Prevents server reload!)
// ====================================================
const otpStore = new Map(); // phone -> { otp, name, expires, attempts, createdAt }

// Clean expired OTPs every 2 minutes
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const [phone, data] of otpStore.entries()) {
    if (data.expires < now) {
      otpStore.delete(phone);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    console.log(`🧹 Cleaned ${cleaned} expired OTPs from memory`);
  }
}, 2 * 60 * 1000);

// ====================================================
// MONGODB DATABASE CONFIGURATION
// ====================================================

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/eventflix';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => {
    console.error('❌ MongoDB Connection Error:', err);
    console.log('⚠️ Please Ensure MongoDB is running or set MONGODB_URI in .env');
  });

// --- SCHEMAS ---

const userSchema = new mongoose.Schema({
  id: { type: String, unique: true }, // Legacy ID format
  phone: { type: String, required: true, unique: true },
  name: String,
  lastLogin: Date,
  createdAt: { type: Date, default: Date.now }
});

const orderSchema = new mongoose.Schema({
  orderId: { type: String, unique: true, required: true },
  customer: {
    name: String,
    phone: String,
    email: String
  },
  booking: {
    location: String,
    date: String,
    slotId: String,
    slotLabel: String,
    package: String
  },
  amount: Number,
  status: { type: String, default: 'pending' }, // pending, paid, cancelled, failed
  paymentSessionId: String,
  cfOrderId: String,
  paymentReference: String,
  createdAt: { type: Date, default: Date.now }
});

// Store booked slots per day per location
const bookedSlotSchema = new mongoose.Schema({
  key: { type: String, unique: true }, // Format: "Location_YYYY-MM-DD"
  location: String,
  date: String,
  bookedSlotIds: [String]
});

const User = mongoose.model('User', userSchema);
const Order = mongoose.model('Order', orderSchema);
const BookedSlot = mongoose.model('BookedSlot', bookedSlotSchema);

// Helper for slot key
const getSlotKey = (date, location) => `${location}_${date}`;

// No file initialization needed for MongoDB

// ====================================================
// CASHFREE CONFIGURATION
// ====================================================
const CASHFREE = {
  APP_ID: process.env.CASHFREE_APP_ID,
  SECRET_KEY: process.env.CASHFREE_SECRET_KEY,
  ENV: process.env.CASHFREE_ENV || 'sandbox',
  get BASE_URL() {
    return this.ENV === 'production'
      ? 'https://api.cashfree.com/pg'
      : 'https://sandbox.cashfree.com/pg';
  },
  get HEADERS() {
    return {
      'Content-Type': 'application/json',
      'x-api-version': '2023-08-01',
      'x-client-id': this.APP_ID,
      'x-client-secret': this.SECRET_KEY
    };
  }
};

// ====================================================
// LOCATION-WISE PACKAGES
// ====================================================
const PACKAGES = {
  "Surat": {
    contact: "7984003900",
    address: "Second floor, 2001 shop no 2nd floor, Event Flix, Veneziano Mall, Vesu, Surat, Gujarat 395007",
    packages: {
      Silver: {
        name: "Silver",
        price: 1999,
        features: [
          "Private Theatre",
          "3 types of beautiful decorations",
          "12 person capacity"
        ]
      },
      Gold: {
        name: "Gold",
        price: 2499,
        popular: true,
        features: [
          "Private Theatre",
          "3 types of beautiful decoration",
          "Cake",
          "Smoke entry"
        ]
      },
      Platinum: {
        name: "Platinum",
        price: 3200,
        features: [
          "Exclusive Private Theatre",
          "3 types of beautiful decorations",
          "Rose entry or Fog Entry",
          "Bubble entry",
          "Cake"
        ]
      }
    }
  },
  "Ahmedabad": {
    contact: "9409495788",
    address: "Aarya Apoch, 311, Vijay Cross Rd, Navrangpura, Ahmedabad, Gujarat 380009",
    packages: {
      Silver: {
        name: "Silver",
        price: 1999,
        features: [
          "Private Theatre",
          "3 types of beautiful decorations",
          "12 person capacity"
        ]
      },
      Gold: {
        name: "Gold",
        price: 2499,
        popular: true,
        features: [
          "Private Theatre",
          "3 types of beautiful decoration",
          "Cake",
          "Smoke entry"
        ]
      },
      Platinum: {
        name: "Platinum",
        price: 3200,
        features: [
          "Exclusive Private Theatre",
          "3 types of beautiful decorations",
          "Rose entry or Fog Entry",
          "Bubble entry",
          "Cake"
        ]
      }
    }
  },
  "Rajkot": {
    contact: "7984003900",
    address: "Event Flix, 4th Floor, KTM Showroom Complex, Amin Marg, 150 Feet Ring Rd, Rajkot, Gujarat 360001",
    packages: {
      Silver: {
        name: "Silver",
        price: 1999,
        features: [
          "Private Theatre",
          "3 types of beautiful decoration"
        ]
      },
      Gold: {
        name: "Gold",
        price: 3200,
        popular: true,
        features: [
          "Exclusive Private Theatre",
          "3 types of decoration",
          "Cake",
          "Rose or Fog entry",
          "Bubble entry"
        ]
      }
    }
  },
  "Junagadh": {
    contact: "7621840803",
    address: "2nd Floor, Event Flix, Krishna Complex, Near Reliance Digital, Madhuvan Society, Vishnu Colony, Junagadh, Gujarat 362002",
    packages: {
      Silver: {
        name: "Silver",
        price: 1999,
        features: [
          "Private Theatre",
          "3 types of beautiful decorations",
          "12 person capacity"
        ]
      },
      Gold: {
        name: "Gold",
        price: 2999,
        popular: true,
        features: [
          "Private Theatre",
          "3 types of beautiful decoration",
          "Cake",
          "Rose entry"
        ]
      },
      Platinum: {
        name: "Platinum",
        price: 3499,
        features: [
          "Exclusive Private Theatre",
          "3 types of beautiful decorations",
          "Fog Entry",
          "Bubble entry",
          "Cake"
        ]
      }
    }
  }
};

// ====================================================
// TIME SLOTS
// ====================================================
const TIME_SLOTS = [
  { id: 'slot-1', label: '11:00 AM - 1:00 PM', start: '11:00', end: '13:00' },
  { id: 'slot-2', label: '1:00 PM - 3:00 PM', start: '13:00', end: '15:00' },
  { id: 'slot-3', label: '3:00 PM - 5:00 PM', start: '15:00', end: '17:00' },
  { id: 'slot-4', label: '5:00 PM - 7:00 PM', start: '17:00', end: '19:00' },
  { id: 'slot-5', label: '7:00 PM - 9:00 PM', start: '19:00', end: '21:00' },
  { id: 'slot-6', label: '9:00 PM - 11:00 PM', start: '21:00', end: '23:00' }
];

// ====================================================
// HELPER FUNCTIONS
// ====================================================
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateOrderId() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `EF${timestamp}${random}`;
}

function generateToken(userId) {
  return crypto.createHash('sha256')
    .update(userId + Date.now().toString() + crypto.randomBytes(16).toString('hex'))
    .digest('hex');
}

function getSlotKey(date, location) {
  return `${date}_${location}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

// ====================================================
// ROOT & HEALTH ROUTES
// ====================================================
app.get("/", (req, res) => {
  const orders = readDB('orders');
  const users = readDB('users');

  res.json({
    status: "✅ EventFlix Server Running",
    version: "2.1.0",
    storage: "JSON Files + In-Memory OTP",
    dataDirectory: DATA_DIR,
    stats: {
      totalOrders: Array.isArray(orders) ? orders.length : 0,
      totalUsers: Array.isArray(users) ? users.length : 0,
      activeOTPs: otpStore.size
    },
    timestamp: new Date().toISOString()
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    activeOTPs: otpStore.size,
    timestamp: new Date().toISOString()
  });
});

// ====================================================
// AUTH ROUTES (Using In-Memory OTP Storage)
// ====================================================

// Send OTP - Now uses in-memory Map (no file writes!)
app.post('/api/auth/send-otp', (req, res) => {
  try {
    const { phone, name } = req.body;

    // Validate phone
    const phoneStr = String(phone || '').replace(/\D/g, '');

    if (!phoneStr || phoneStr.length !== 10) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid 10-digit phone number'
      });
    }

    // Check rate limiting (max 5 OTPs per phone per hour)
    const existing = otpStore.get(phoneStr);
    if (existing && existing.createdAt) {
      const timeSinceLastOTP = Date.now() - new Date(existing.createdAt).getTime();
      if (timeSinceLastOTP < 30000) { // 30 seconds cooldown
        return res.status(429).json({
          success: false,
          message: 'Please wait 30 seconds before requesting another OTP'
        });
      }
    }

    // Generate OTP
    const otp = generateOTP();
    const expires = Date.now() + 5 * 60 * 1000; // 5 minutes

    // Store in memory (NO FILE WRITE - prevents server reload!)
    otpStore.set(phoneStr, {
      otp: otp,
      name: name || '',
      expires: expires,
      attempts: 0,
      createdAt: new Date().toISOString()
    });

    console.log(`📱 OTP for ${phoneStr}: ${otp} (stored in memory)`);

    // ====================================================
    // WHAPI INTEGRATION (Send WhatsApp OTP)
    // ====================================================
    // const WHAPI_TOKEN = process.env.WHAPI_TOKEN;
    // const WHAPI_URL = process.env.WHAPI_URL || 'https://gate.whapi.cloud/messages/text';

    // if (WHAPI_TOKEN) {
    //   try {
    //     await axios.post(WHAPI_URL, {
    //       to: `91${phoneStr}@s.whatsapp.net`,
    //       body: `Your EventFlix verification code is: ${otp}. Do not share this with anyone.`
    //     }, {
    //       headers: {
    //         'Authorization': `Bearer ${WHAPI_TOKEN}`,
    //         'Content-Type': 'application/json'
    //       }
    //     });
    //     console.log(`✅ Whapi: OTP sent to ${phoneStr}`);
    //   } catch (err) {
    //     console.error('❌ Whapi Error:', err?.response?.data || err.message);
    //     // Continue execution so we don't block the UI, but log the error
    //   }
    // } else {
    //   console.log('⚠️ WHAPI_TOKEN not set. OTP not sent via WhatsApp.');
    // }

    res.json({
      success: true,
      message: 'OTP sent successfully to +91 ' + phoneStr,
      // In production, do NOT send OTP in response
      // For testing without Whapi, check the server console
      isDemo: !WHAPI_TOKEN 
    });

  } catch (error) {
    console.error('Send OTP Error:', error);
    res.status(500).json({ success: false, message: 'Failed to send OTP' });
  }
});

// Verify OTP - Uses in-memory Map
app.post('/api/auth/verify-otp', async (req, res) => {
  try {
    const { phone, otp, name } = req.body;
    const phoneStr = String(phone || '').replace(/\D/g, '');
    const otpStr = String(otp || '').trim();

    if (!phoneStr || phoneStr.length !== 10) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number'
      });
    }

    if (!otpStr || otpStr.length !== 6) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid 6-digit OTP'
      });
    }

    // Get OTP from memory
    const storedOTP = otpStore.get(phoneStr);

    if (!storedOTP) {
      return res.status(400).json({
        success: false,
        message: 'OTP expired or not found. Please request a new OTP.'
      });
    }

    // Check expiry
    if (Date.now() > storedOTP.expires) {
      otpStore.delete(phoneStr);
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new OTP.'
      });
    }

    // Check attempts
    if (storedOTP.attempts >= 3) {
      otpStore.delete(phoneStr);
      return res.status(400).json({
        success: false,
        message: 'Too many failed attempts. Please request a new OTP.'
      });
    }

    // Verify OTP
    if (storedOTP.otp !== otpStr) {
      storedOTP.attempts++;
      otpStore.set(phoneStr, storedOTP);
      return res.status(400).json({
        success: false,
        message: `Invalid OTP. ${3 - storedOTP.attempts} attempts remaining.`
      });
    }

    // OTP verified - remove from memory
    otpStore.delete(phoneStr);

    // MONGODB: Find or Update User
    let user = await User.findOne({ phone: phoneStr });

    if (!user) {
      // New user
      user = new User({
        id: 'user_' + Date.now(),
        phone: phoneStr,
        name: name || storedOTP.name || 'Guest',
        lastLogin: new Date()
      });
      await user.save();
      console.log(`👤 New user registered: ${phoneStr}`);
    } else {
      // Existing user
      if (name) user.name = name;
      user.lastLogin = new Date();
      await user.save();
    }

    // Generate token
    const token = generateToken(user.id);

    console.log(`✅ Login successful: ${phoneStr}`);

    res.json({
      success: true,
      message: 'Login successful',
      token: token,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name
      }
    });

  } catch (error) {
    console.error('Verify OTP Error:', error);
    res.status(500).json({ success: false, message: 'Verification failed' });
  }
});

// Get user by phone
app.get('/api/auth/user/:phone', async (req, res) => {
  try {
    const phoneStr = String(req.params.phone || '').replace(/\D/g, '');
    
    // MONGODB
    const user = await User.findOne({ phone: phoneStr });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, user });
  } catch (error) {
    console.error('Get User Error:', error);
    res.status(500).json({ success: false, message: 'Failed to get user' });
  }
});

// ====================================================
// LOCATION & PACKAGE ROUTES
// ====================================================

// Get all locations
app.get('/api/locations', (req, res) => {
  const locations = Object.keys(PACKAGES).map(name => ({
    name,
    contact: PACKAGES[name].contact,
    address: PACKAGES[name].address,
    packageCount: Object.keys(PACKAGES[name].packages).length
  }));

  res.json({ success: true, locations });
});

// Get packages for a location
app.get('/api/packages/:location', (req, res) => {
  const { location } = req.params;
  const locationData = PACKAGES[location];

  if (!locationData) {
    return res.status(404).json({
      success: false,
      message: 'Location not found',
      availableLocations: Object.keys(PACKAGES)
    });
  }

  res.json({
    success: true,
    location,
    contact: locationData.contact,
    address: locationData.address,
    packages: locationData.packages
  });
});

// ====================================================
// SLOT ROUTES
// ====================================================

// Get available slots
app.get('/api/slots', async (req, res) => {
  try {
    const { date, location } = req.query;

    if (!date || !location) {
      return res.status(400).json({
        success: false,
        message: 'Date and location are required'
      });
    }

    // MONGODB: Read booked slots
    const slotKey = getSlotKey(date, location);
    const bookings = await BookedSlot.findOne({ key: slotKey });
    const bookedSlotIds = bookings ? bookings.bookedSlotIds : [];

    // Check if date is in the past
    const selectedDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isPast = selectedDate < today;

    // Build slots with availability
    const slots = TIME_SLOTS.map(slot => ({
      ...slot,
      available: isPast ? false : !bookedSlotIds.includes(slot.id),
      booked: isPast ? true : bookedSlotIds.includes(slot.id)
    }));

    res.json({
      success: true,
      date,
      location,
      formattedDate: formatDate(date),
      slots,
      availableCount: slots.filter(s => s.available).length,
      bookedCount: slots.filter(s => s.booked).length
    });

  } catch (error) {
    console.error('Get Slots Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch slots' });
  }
});

// Check single slot availability
app.get('/api/slots/check', async (req, res) => {
  try {
    const { date, location, slotId } = req.query;

    if (!date || !location || !slotId) {
      return res.status(400).json({
        success: false,
        message: 'Date, location, and slotId are required'
      });
    }

    const slotKey = getSlotKey(date, location);
    const bookings = await BookedSlot.findOne({ key: slotKey });
    const bookedSlotIds = bookings ? bookings.bookedSlotIds : [];

    const isAvailable = !bookedSlotIds.includes(slotId);

    res.json({
      success: true,
      slotId,
      available: isAvailable,
      booked: !isAvailable
    });

  } catch (error) {
    console.error('Check Slot Error:', error);
    res.status(500).json({ success: false, message: 'Failed to check slot' });
  }
});

// Book a slot (internal helper)
async function bookSlot(date, location, slotId) {
  try {
    const slotKey = getSlotKey(date, location);
    
    // Atomically add slotId if not present
    await BookedSlot.findOneAndUpdate(
      { key: slotKey },
      { 
        $setOnInsert: { location, date },
        $addToSet: { bookedSlotIds: slotId }
      },
      { upsert: true, new: true }
    );
    
    console.log(`📅 Slot booked: ${slotId} on ${date} at ${location}`);
    return true;
  } catch (error) {
    console.error('Book Slot Error:', error);
    return false;
  }
}

// Free a slot (for cancellation)
async function freeSlot(date, location, slotId) {
  try {
    const slotKey = getSlotKey(date, location);

    const res = await BookedSlot.updateOne(
      { key: slotKey },
      { $pull: { bookedSlotIds: slotId } }
    );

    if (res.modifiedCount > 0) {
      console.log(`🔓 Slot freed: ${slotId} on ${date} at ${location}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Free Slot Error:', error);
    return false;
  }
}

// ====================================================
// ORDER ROUTES
// ====================================================

// Create order
app.post('/api/orders/create', async (req, res) => {
  try {
    const { customer, booking } = req.body;

    // Validate customer
    if (!customer?.name || !customer?.phone) {
      return res.status(400).json({
        success: false,
        message: 'Customer name and phone are required'
      });
    }

    // Validate booking
    if (!booking?.location || !booking?.date || !booking?.slotId || !booking?.package) {
      return res.status(400).json({
        success: false,
        message: 'Booking details are incomplete'
      });
    }

    // Verify location and package exist
    const locationData = PACKAGES[booking.location];
    if (!locationData) {
      return res.status(400).json({ success: false, message: 'Invalid location' });
    }

    const packageData = locationData.packages[booking.package];
    if (!packageData) {
      return res.status(400).json({ success: false, message: 'Invalid package for this location' });
    }

    // MONGODB: Check slot availability
    const slotKey = getSlotKey(booking.date, booking.location);
    const slotData = await BookedSlot.findOne({ key: slotKey });
    const bookedIds = slotData ? slotData.bookedSlotIds : [];

    if (bookedIds.includes(booking.slotId)) {
      return res.status(400).json({
        success: false,
        message: 'Sorry, this slot has already been booked. Please choose another slot.'
      });
    }

    // Get slot label
    const slotInfo = TIME_SLOTS.find(s => s.id === booking.slotId);
    if (!slotInfo) {
      return res.status(400).json({ success: false, message: 'Invalid slot' });
    }

    // Generate order ID
    const orderId = generateOrderId();
    const amount = packageData.price;

    console.log(`\n💰 Creating Order: ${orderId}`);
    console.log(`   Customer: ${customer.name} (${customer.phone})`);
    console.log(`   Package: ${booking.package} @ ${booking.location}`);
    console.log(`   Amount: ₹${amount}`);

    // Try Cashfree integration
    let paymentSessionId = null;
    let cfOrderId = null;

    if (CASHFREE.APP_ID && CASHFREE.SECRET_KEY) {
      try {
        const orderData = {
          order_id: orderId,
          order_amount: amount,
          order_currency: "INR",
          customer_details: {
            customer_id: `cust_${customer.phone}`,
            customer_name: customer.name,
            customer_email: customer.email || `${customer.phone}@eventflix.temp`,
            customer_phone: String(customer.phone)
          },
          order_meta: {
            return_url: `${process.env.FRONTEND_URL || 'http://127.0.0.1:5500'}/booking-success.html?order_id=${orderId}`
          }
        };

        const cfResponse = await axios.post(
          `${CASHFREE.BASE_URL}/orders`,
          orderData,
          { headers: CASHFREE.HEADERS }
        );

        paymentSessionId = cfResponse.data.payment_session_id;
        cfOrderId = cfResponse.data.cf_order_id;
        console.log(`   Cashfree Order: ${cfOrderId}`);

      } catch (cfError) {
        console.log('   Cashfree Error:', cfError.response?.data?.message || cfError.message);
        console.log('   Falling back to demo mode');
      }
    }

    // MONGODB: Create order
    const order = await Order.create({
      orderId,
      customer: {
        name: customer.name,
        phone: String(customer.phone).replace(/\D/g, ''),
        email: customer.email || null
      },
      booking: {
        location: booking.location,
        date: booking.date,
        slotId: booking.slotId,
        slotLabel: slotInfo.label,
        package: booking.package
      },
      amount,
      status: 'pending',
      cfOrderId,
      paymentSessionId
    });

    console.log(`   ✅ Order saved to database`);

    res.json({
      success: true,
      orderId,
      amount,
      paymentSessionId,
      cfOrderId,
      order
    });

  } catch (error) {
    console.error('Create Order Error:', error);
    res.status(500).json({ success: false, message: 'Failed to create order' });
  }
});

// Verify payment and confirm booking
app.post('/api/orders/verify', async (req, res) => {
  try {
    const { orderId, demo } = req.body;

    if (!orderId) {
      return res.status(400).json({ success: false, message: 'Order ID required' });
    }

    // MONGODB: Find order
    let order = await Order.findOne({ orderId });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // If already confirmed, return success
    if (order.status === 'confirmed') {
      return res.json({
        success: true,
        paid: true,
        order
      });
    }

    // Check with Cashfree if possible
    let isPaid = false;

    if (CASHFREE.APP_ID && CASHFREE.SECRET_KEY && order.cfOrderId) {
      try {
        const response = await axios.get(
          `${CASHFREE.BASE_URL}/orders/${orderId}`,
          { headers: CASHFREE.HEADERS }
        );
        isPaid = response.data.order_status === 'PAID';
        console.log(`   Cashfree status: ${response.data.order_status}`);
      } catch (e) {
        console.log('   Cashfree check failed, using demo mode');
      }
    }

    // Demo mode
    if (demo === true || demo === 'true') {
      isPaid = true;
      console.log(`   Demo mode: Payment simulated for ${orderId}`);
    }

    // Update order if paid
    if (isPaid) {
      order.status = 'confirmed';
      order.set('paidAt', new Date()); // Mongoose set for custom fields
      await order.save();

      // Book the slot
      await bookSlot(order.booking.date, order.booking.location, order.booking.slotId);

      console.log(`✅ Order Confirmed: ${orderId}`);
    }

    res.json({
      success: true,
      paid: order.status === 'confirmed',
      order
    });

  } catch (error) {
    console.error('Verify Order Error:', error);
    res.status(500).json({ success: false, message: 'Verification failed' });
  }
});

// Get order by ID
app.get('/api/orders/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findOne({ orderId });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    res.json({ success: true, order });

  } catch (error) {
    console.error('Get Order Error:', error);
    res.status(500).json({ success: false, message: 'Failed to get order' });
  }
});

// Get orders by phone
app.get('/api/orders', async (req, res) => {
  try {
    const { phone } = req.query;

    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number required' });
    }

    const phoneStr = String(phone).replace(/\D/g, '');
    
    // MONGODB: Find orders for customer phone
    const userOrders = await Order.find({ 'customer.phone': phoneStr }).sort({ createdAt: -1 });

    res.json({ success: true, orders: userOrders, count: userOrders.length });

  } catch (error) {
    console.error('Get Orders Error:', error);
    res.status(500).json({ success: false, message: 'Failed to get orders' });
  }
});

// Cancel order
app.post('/api/orders/cancel', async (req, res) => {
  try {
    const { orderId, phone, reason } = req.body;

    if (!orderId) {
      return res.status(400).json({ success: false, message: 'Order ID required' });
    }

    const order = await Order.findOne({ orderId });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Verify ownership if phone provided
    if (phone) {
      const phoneStr = String(phone).replace(/\D/g, '');
      if (order.customer?.phone !== phoneStr) {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
      }
    }

    if (order.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Already cancelled' });
    }

    // Update order
    order.status = 'cancelled';
    order.set('cancelledAt', new Date());
    order.set('cancellationReason', reason || 'User requested cancellation');
    await order.save();

    // Free the slot
    await freeSlot(order.booking.date, order.booking.location, order.booking.slotId);

    console.log(`🚫 Order Cancelled: ${orderId}`);

    res.json({
      success: true,
      message: 'Booking cancelled. Refund will be processed in 5-7 business days.',
      order
    });

  } catch (error) {
    console.error('Cancel Order Error:', error);
    res.status(500).json({ success: false, message: 'Cancellation failed' });
  }
});

// ====================================================
// ADMIN ROUTES
// ====================================================

// Admin login
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;

  const admins = {
    'admin': { password: 'admin123', name: 'Admin', role: 'super_admin' },
    'manager': { password: 'manager123', name: 'Manager', role: 'manager' }
  };

  const admin = admins[username];
  if (!admin || admin.password !== password) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  const token = generateToken(username);

  res.json({
    success: true,
    token,
    admin: { username, name: admin.name, role: admin.role }
  });
});

// Get all orders (admin)
app.get('/api/admin/orders', async (req, res) => {
  try {
    const orders = await Order.find({}).sort({ createdAt: -1 });
    res.json({ success: true, count: orders.length, orders });
  } catch (error) {
    console.error('Admin Orders Error:', error);
    res.status(500).json({ success: false, message: 'Failed to get orders' });
  }
});

// Get all users (admin)
app.get('/api/admin/users', async (req, res) => {
  try {
    const users = await User.find({}).sort({ createdAt: -1 });
    res.json({ success: true, count: users.length, users });
  } catch (error) {
    console.error('Admin Users Error:', error);
    res.status(500).json({ success: false, message: 'Failed to get users' });
  }
});

// Get all slots (admin)
app.get('/api/admin/slots', async (req, res) => {
  try {
    const bookedSlotsLineItems = await BookedSlot.find({});
    
    // Transform to legacy object format for frontend compatibility
    // Format: { "Surat_2023-11-20": ["slot-1", "slot-2"] }
    const slotsObj = {};
    bookedSlotsLineItems.forEach(item => {
      if (item.key) {
        slotsObj[item.key] = item.bookedSlotIds;
      }
    });

    res.json({ success: true, slots: slotsObj });
  } catch (error) {
    console.error('Admin Slots Error:', error);
    res.status(500).json({ success: false, message: 'Failed to get slots' });
  }
});

// Get dashboard stats
app.get('/api/admin/stats', async (req, res) => {
  try {
    const orders = await Order.find({});
    const userCount = await User.countDocuments();

    const confirmed = orders.filter(o => o.status === 'confirmed');
    const pending = orders.filter(o => o.status === 'pending');
    const cancelled = orders.filter(o => o.status === 'cancelled');

    const totalRevenue = confirmed.reduce((sum, o) => sum + (o.amount || 0), 0);

    // Location stats
    const locationStats = {};
    Object.keys(PACKAGES).forEach(loc => {
      locationStats[loc] = orders.filter(o => o.booking?.location === loc).length;
    });

    // Package stats
    const packageStats = { Silver: 0, Gold: 0, Platinum: 0 };
    orders.forEach(o => {
      const pkg = o.booking?.package;
      if (pkg && packageStats.hasOwnProperty(pkg)) {
        packageStats[pkg]++;
      }
    });

    res.json({
      success: true,
      stats: {
        totalOrders: orders.length,
        confirmedOrders: confirmed.length,
        pendingOrders: pending.length,
        cancelledOrders: cancelled.length,
        totalRevenue,
        totalCustomers: userCount,
        activeOTPs: otpStore.size,
        locationStats,
        packageStats
      }
    });

  } catch (error) {
    console.error('Admin Stats Error:', error);
    res.status(500).json({ success: false, message: 'Failed to get stats' });
  }
});

// Update order status (admin)
app.put('/api/admin/orders/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    const order = await Order.findOne({ orderId });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const oldStatus = order.status;

    order.status = status;
    order.set('updatedAt', new Date());

    await order.save();

    // Handle slot booking/freeing
    if (status === 'confirmed' && oldStatus !== 'confirmed') {
      await bookSlot(order.booking.date, order.booking.location, order.booking.slotId);
    } else if (status === 'cancelled' && oldStatus === 'confirmed') {
      await freeSlot(order.booking.date, order.booking.location, order.booking.slotId);
    }

    res.json({ success: true, order });

  } catch (error) {
    console.error('Update Order Error:', error);
    res.status(500).json({ success: false, message: 'Failed to update order' });
  }
});

// ====================================================
// PAYMENT WEBHOOK
// ====================================================
app.post('/api/payment/webhook', async (req, res) => {
  console.log('\n📬 Webhook received:', JSON.stringify(req.body, null, 2));

  try {
    const data = req.body.data || req.body;
    const orderId = data.order?.order_id;
    const paymentStatus = data.payment?.payment_status;

    // Determine status from different webhook payloads structure
    const isSuccess = paymentStatus === 'SUCCESS' || data.type === 'PAYMENT_SUCCESS_WEBHOOK';

    if (orderId && isSuccess) {
      const order = await Order.findOne({ orderId });

      if (order && order.status !== 'confirmed') {
        order.status = 'confirmed';
        order.set('paidAt', new Date());
        await order.save();

        await bookSlot(order.booking.date, order.booking.location, order.booking.slotId);

        console.log(`✅ Webhook: Order ${orderId} confirmed`);
      }
    }

    // Cashfree expects 200 OK
    res.status(200).json({ received: true });

  } catch (error) {
    console.error('Webhook Error:', error);
    res.status(200).json({ received: true });
  }
});

// ====================================================
// DEBUG ROUTES
// ====================================================

// View all data
app.get('/api/debug/all', async (req, res) => {
  // Convert Map to object for display
  const otpData = {};
  for (const [phone, data] of otpStore.entries()) {
    otpData[phone] = {
      ...data,
      expiresIn: Math.max(0, Math.round((data.expires - Date.now()) / 1000)) + 's'
    };
  }

  res.json({
    users: await User.find({}).limit(10),
    orders: await Order.find({}).limit(10).sort({ createdAt: -1 }),
    slots: await BookedSlot.find({}),
    otps: otpData,
    otpCount: otpStore.size
  });
});

// View active OTPs
app.get('/api/debug/otps', (req, res) => {
  const otpData = [];
  for (const [phone, data] of otpStore.entries()) {
    otpData.push({
      phone,
      otp: data.otp,
      name: data.name,
      expiresIn: Math.max(0, Math.round((data.expires - Date.now()) / 1000)) + ' seconds',
      attempts: data.attempts
    });
  }
  res.json({ success: true, count: otpData.length, otps: otpData });
});

// Reset/Clear all data (development only)
app.post('/api/debug/reset', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ success: false, message: 'Not allowed in production' });
  }

  // Clear MongoDB Collections
  await User.deleteMany({});
  await Order.deleteMany({});
  await BookedSlot.deleteMany({});

  // Clear OTP store
  otpStore.clear();

  console.log('🗑️ All data reset');
  res.json({ success: true, message: 'All data reset (MongoDB + OTPs)' });
});

// ====================================================
// ERROR HANDLING
// ====================================================

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// ====================================================
// START SERVER
// ====================================================

app.listen(PORT, () => {
  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log('║           🎬 EVENTFLIX SERVER STARTED               ║');
  console.log('╠════════════════════════════════════════════════════╣');
  console.log(`║  🌐 Server:     http://localhost:${PORT}               ║`);
  console.log(`║  💾 Storage:    MongoDB + In-Memory OTP             ║`);
  console.log('╠════════════════════════════════════════════════════╣');
  console.log('║  📦 Locations:  Surat, Ahmedabad, Rajkot, Junagadh  ║');
  console.log('╠════════════════════════════════════════════════════╣');
  console.log('║  ⚡ OTP Storage: IN-MEMORY (No DB/File writes)      ║');
  console.log('╚════════════════════════════════════════════════════╝\n');
  
  console.log(`   💾 OTPs: In-memory (${otpStore.size} active)\n`);
});

export default app;