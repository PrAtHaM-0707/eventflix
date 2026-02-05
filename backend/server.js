import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import connectDB from './config/db.js';
import { seedData } from './utils/seedData.js';
import logger from './utils/logger.js';

import authRoutes from './routes/authRoutes.js';
import slotRoutes from './routes/slotRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import packageRoutes from './routes/packageRoutes.js';

dotenv.config();

// Connect to MongoDB
connectDB().then(() => {
    seedData();
}).catch(err => {
    logger.error("Database connection failed", err);
});

const app = express();
const PORT = process.env.PORT || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Security Middleware
app.use(helmet({
    contentSecurityPolicy: false, // Disable CSP to allow simple frontend loading
}));

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again after 15 minutes',
    standardHeaders: true, 
    legacyHeaders: false,
});
// Apply rate limiter to all api routes
app.use('/api', limiter);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../'))); // Serve static frontend files

// Request logging
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`);
    next();
});

// Admin Panel Shortcut
app.get('/admin', (req, res) => {
    res.redirect('/Admin%20Panel/admin-login.html');
});

// API Routes
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));
app.use('/api/auth', authRoutes);
app.use('/api/slots', slotRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', packageRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
    logger.error('Server Error:', err);
    res.status(500).json({ 
        success: false, 
        message: 'Internal Server Error', 
        error: process.env.NODE_ENV === 'development' ? err.message : undefined 
    });
});

process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection:', reason);
});

app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
});
