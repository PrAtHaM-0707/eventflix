import express from 'express';
import { sendOTP, verifyOTP, getUser, registerDirect } from '../controllers/authController.js';

const router = express.Router();

router.post('/send-otp', sendOTP);
router.post('/verify-otp', verifyOTP);
router.post('/login-direct', registerDirect);
router.get('/user/:phone', getUser);

export default router;
