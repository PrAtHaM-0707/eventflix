import User from '../models/User.js';
import { generateOTP, generateToken } from '../utils/helpers.js';
import axios from 'axios';
import logger from '../utils/logger.js';

// In-Memory OTP Store
export const otpStore = new Map();

// Clean expired OTPs
setInterval(() => {
  const now = Date.now();
  for (const [phone, data] of otpStore.entries()) {
    if (data.expires < now) {
      otpStore.delete(phone);
    }
  }
}, 2 * 60 * 1000);

export const sendOTP = async (req, res) => {
  try {
    const { phone, name } = req.body;
    const phoneStr = String(phone || '').replace(/\D/g, '');

    if (!phoneStr || phoneStr.length !== 10) {
      return res.status(400).json({ success: false, message: 'Invalid phone number' });
    }

    const existing = otpStore.get(phoneStr);
    if (existing && existing.createdAt) {
        if (Date.now() - new Date(existing.createdAt).getTime() < 30000) {
            return res.status(429).json({ success: false, message: 'Wait 30s before retrying' });
        }
    }

    const otp = generateOTP();
    const expires = Date.now() + 5 * 60 * 1000;

    otpStore.set(phoneStr, {
      otp,
      name: name || '',
      expires,
      attempts: 0,
      createdAt: new Date().toISOString()
    });

    // Only log OTP in dev mode
    if (process.env.NODE_ENV !== 'production') {
       logger.debug(`OTP for ${phoneStr}: ${otp}`);
    }

    // Whapi Integration
    const WHAPI_TOKEN = process.env.WHAPI_TOKEN;
    const WHAPI_URL = process.env.WHAPI_URL || 'https://gate.whapi.cloud/messages/text';

    if (WHAPI_TOKEN) {
      try {
        await axios.post(WHAPI_URL, {
          to: `91${phoneStr}@s.whatsapp.net`,
          body: `Your EventFlix verification code is: ${otp}`
        }, {
          headers: { 
            'Authorization': `Bearer ${WHAPI_TOKEN}`,
            'Content-Type': 'application/json' 
          }
        });
        logger.info(`Whapi: OTP sent to ${phoneStr}`);
      } catch (err) {
        logger.error('Whapi Error:', err?.response?.data || err.message);
      }
    } else {
      logger.warn('WHAPI_TOKEN missing. Using Demo Mode.');
    }

    res.json({
      success: true,
      message: 'OTP sent',
       // Remove isDemo/otp in production
      isDemo: !WHAPI_TOKEN
    });

  } catch (error) {
    logger.error('Send OTP Error:', error);
    res.status(500).json({ success: false, message: 'Failed to send OTP' });
  }
};

export const verifyOTP = async (req, res) => {
  try {
    const { phone, otp, name } = req.body;
    const phoneStr = String(phone).replace(/\D/g, '');
    const otpStr = String(otp).trim();

    const storedOTP = otpStore.get(phoneStr);

    if (!storedOTP) {
        return res.status(400).json({ success: false, message: 'OTP expired or not found' });
    }
    
    if (Date.now() > storedOTP.expires) {
        otpStore.delete(phoneStr);
        return res.status(400).json({ success: false, message: 'OTP expired' });
    }

    if (storedOTP.otp !== otpStr) {
        storedOTP.attempts++;
        otpStore.set(phoneStr, storedOTP);
        return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    otpStore.delete(phoneStr);

    let user = await User.findOne({ phone: phoneStr });
    if (!user) {
        user = await User.create({
            id: 'user_' + Date.now(),
            phone: phoneStr,
            name: name || storedOTP.name || 'Guest',
            lastLogin: new Date()
        });
    } else {
        if (name) user.name = name;
        user.lastLogin = new Date();
        await user.save();
    }

    const token = generateToken(user.id);
    res.json({
        success: true,
        message: 'Login successful',
        token,
        user: { id: user.id, phone: user.phone, name: user.name }
    });

  } catch (error) {
    console.error('Verify OTP Error:', error);
    res.status(500).json({ success: false, message: 'Verification failed' });
  }
};

export const getUser = async (req, res) => {
    try {
        const phone = req.params.phone.replace(/\D/g, '');
        const user = await User.findOne({ phone });
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        res.json({ success: true, user });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching user' });
    }
};

export const registerDirect = async (req, res) => {
    try {
        const { phone, name } = req.body;
        const phoneStr = String(phone).replace(/\D/g, '');

        if (!phoneStr || phoneStr.length !== 10) {
            return res.status(400).json({ success: false, message: 'Invalid phone number' });
        }

        let user = await User.findOne({ phone: phoneStr });
        if (!user) {
            user = await User.create({
                id: 'user_' + Date.now(),
                phone: phoneStr,
                name: name || 'Guest',
                lastLogin: new Date()
            });
        } else {
            if (name) user.name = name;
            user.lastLogin = new Date();
            await user.save();
        }

        const token = generateToken(user.id);
        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: { id: user.id, phone: user.phone, name: user.name }
        });

    } catch (error) {
        console.error('Direct Login Error:', error);
        res.status(500).json({ success: false, message: 'Login failed' });
    }
};
