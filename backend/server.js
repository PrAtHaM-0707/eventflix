import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Config & Database
import connectDB from './config/db.js';
import { seedData } from './utils/seedData.js';

// Routes
import authRoutes from './routes/authRoutes.js';
import slotRoutes from './routes/slotRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import packageRoutes from './routes/packageRoutes.js';

// Initialize Environment
dotenv.config();

// Connect to MongoDB
connectDB().then(() => {
    // Run seed data checks after database connection is established
    seedData();
}).catch(err => {
    console.error("Database connection failed", err);
});

const app = express();
const PORT = process.env.PORT || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../'))); // Serve static frontend files from 'eventflix/' root

// Request logging (simplified version of what you had)
app.use((req, res, next) => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] ${req.method} ${req.path}`);
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

// Error Handling Middlewaree
app.use((err, req, res, next) => {
    console.error('🔥 Server Error:', err.stack);
    res.status(500).json({ 
        success: false, 
        message: 'Internal Server Error', 
        error: process.env.NODE_ENV === 'development' ? err.message : undefined 
    });
});

// Handle Uncaught Exceptions & Rejections
process.on('uncaughtException', (err) => {
    console.error('🔥 Uncaught Exception:', err);
    // Keep server running in dev mode, or exit in production
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('🔥 Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
