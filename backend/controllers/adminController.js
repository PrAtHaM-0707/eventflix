import Order from '../models/Order.js';
import User from '../models/User.js';
import BookedSlot from '../models/BookedSlot.js';
import { PACKAGES } from '../data/constants.js';
import { generateToken } from '../utils/helpers.js';
import { bookSlotInternal, freeSlotInternal } from './slotController.js';
import { otpStore } from './authController.js';

export const loginAdmin = (req, res) => {
    const { username, password } = req.body;
    
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    if (username === adminUsername && password === adminPassword) {
        const token = generateToken(username);
        return res.json({ 
            success: true, 
            token, 
            admin: { 
                username: adminUsername, 
                name: 'Administrator', 
                role: 'super_admin' 
            } 
        });
    }

    return res.status(401).json({ success: false, message: 'Invalid credentials' });
};

export const getAdminOrders = async (req, res) => {
    try {
        const orders = await Order.find({}).sort({ createdAt: -1 });
        res.json({ success: true, count: orders.length, orders });
    } catch (e) {
        res.status(500).json({ success: false });
    }
};

export const getAdminUsers = async (req, res) => {
    try {
        const users = await User.find({}).sort({ createdAt: -1 });
        res.json({ success: true, count: users.length, users });
    } catch (e) {
        res.status(500).json({ success: false });
    }
};

export const getAdminSlots = async (req, res) => {
    try {
        const slots = await BookedSlot.find({});
        const slotsObj = {};
        slots.forEach(s => { if (s.key) slotsObj[s.key] = s.bookedSlotIds; });
        res.json({ success: true, slots: slotsObj });
    } catch (e) {
        res.status(500).json({ success: false });
    }
};



export const getStats = async (req, res) => {
    try {
        const orders = await Order.find({});
        const users = await User.countDocuments();
        const conf = orders.filter(o => o.status === 'confirmed');
        const pen = orders.filter(o => o.status === 'pending');
        const can = orders.filter(o => o.status === 'cancelled');
        const revenue = conf.reduce((acc, o) => acc + (o.amount || 0), 0);

        const locStats = {};
        Object.keys(PACKAGES).forEach(l => locStats[l] = 0);
        orders.forEach(o => { if (locStats[o.booking.location] !== undefined) locStats[o.booking.location]++ });

        const pkgStats = { Silver: 0, Gold: 0, Platinum: 0 };
        orders.forEach(o => { if (pkgStats[o.booking.package] !== undefined) pkgStats[o.booking.package]++ });

        res.json({
            success: true,
            stats: {
                totalOrders: orders.length,
                confirmedOrders: conf.length,
                pendingOrders: pen.length,
                cancelledOrders: can.length,
                totalRevenue: revenue,
                totalCustomers: users,
                activeOTPs: otpStore.size,
                locationStats: locStats,
                packageStats: pkgStats
            }
        });
    } catch (e) {
        res.status(500).json({ success: false });
    }
};


export const updateOrderStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status } = req.body;
        
        const order = await Order.findOne({ orderId });
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

        const oldStatus = order.status;
        order.status = status;

        if (status === 'confirmed' && oldStatus !== 'confirmed') {
            order.paidAt = new Date();
            // Import bookSlotInternal if not available in scope, but it is imported at top
            await bookSlotInternal(order.booking.date, order.booking.location, order.booking.slotId, order.booking.package);
        } else if (status === 'cancelled' && oldStatus !== 'cancelled') {
            order.cancelledAt = new Date();
            await freeSlotInternal(order.booking.date, order.booking.location, order.booking.slotId, order.booking.package);
        }

        await order.save();
        res.json({ success: true, order });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, message: e.message });
    }
};
