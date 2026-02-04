import Order from '../models/Order.js';
import BookedSlot from '../models/BookedSlot.js';
import { PACKAGES, TIME_SLOTS } from '../data/constants.js';
import { generateOrderId, getSlotKey } from '../utils/helpers.js';
import { bookSlotInternal, freeSlotInternal } from './slotController.js';
import axios from 'axios';

// Cashfree config
const getCashfreeConfig = () => ({
    APP_ID: process.env.CASHFREE_APP_ID,
    SECRET_KEY: process.env.CASHFREE_SECRET_KEY,
    BASE_URL: (process.env.CASHFREE_ENV || 'sandbox') === 'production' 
        ? 'https://api.cashfree.com/pg' 
        : 'https://sandbox.cashfree.com/pg',
    HEADERS: {
        'Content-Type': 'application/json',
        'x-api-version': '2023-08-01',
        'x-client-id': process.env.CASHFREE_APP_ID,
        'x-client-secret': process.env.CASHFREE_SECRET_KEY
    }
});

export const createOrder = async (req, res) => {
    try {
        const { customer, booking } = req.body;
        // Basic validations
        if (!customer?.name || !customer?.phone || !booking?.location || !booking?.date || !booking?.slotId) {
            return res.status(400).json({ success: false, message: 'Missing details' });
        }

        const locationData = PACKAGES[booking.location];
        if (!locationData) return res.status(400).json({ success: false, message: 'Invalid location' });
        
        const packageData = locationData.packages[booking.package];
        if (!packageData) return res.status(400).json({ success: false, message: 'Invalid package' });

        // Check availability
        const slotKey = getSlotKey(booking.date, booking.location);
        const slotDoc = await BookedSlot.findOne({ key: slotKey });
        if (slotDoc && slotDoc.bookedSlotIds.includes(booking.slotId)) {
            return res.status(400).json({ success: false, message: 'Slot already booked' });
        }

        const slotInfo = TIME_SLOTS.find(s => s.id === booking.slotId);
        const orderId = generateOrderId();
        const amount = packageData.price;
        const config = getCashfreeConfig();

        let paymentSessionId = null;
        let cfOrderId = null;

        if (config.APP_ID) {
            try {
                const cfRes = await axios.post(`${config.BASE_URL}/orders`, {
                    order_id: orderId,
                    order_amount: amount,
                    order_currency: "INR",
                    customer_details: {
                        customer_id: `cust_${customer.phone}`,
                        customer_name: customer.name,
                        customer_phone: String(customer.phone)
                    },
                    order_meta: {
                        return_url: `${process.env.FRONTEND_URL || 'http://127.0.0.1:5500'}/booking-success.html?order_id=${orderId}`
                    }
                }, { headers: config.HEADERS });
                paymentSessionId = cfRes.data.payment_session_id;
                cfOrderId = cfRes.data.cf_order_id;
            } catch (e) {
                console.log('Cashfree Error, using demo mode');
            }
        }

        const order = await Order.create({
            orderId,
            customer: {
                 name: customer.name,
                 phone: String(customer.phone).replace(/\D/g, ''),
                 email: customer.email
            },
            booking: {
                location: booking.location,
                date: booking.date,
                slotId: booking.slotId,
                slotLabel: slotInfo.label,
                package: booking.package,
                packagePrice: amount,
                features: packageData.features
            },
            amount,
            cfOrderId,
            paymentSessionId
        });

        res.json({ success: true, orderId, amount, paymentSessionId, order });

    } catch (error) {
        console.error('Create Order Error:', error);
        res.status(500).json({ success: false, message: 'Order creation failed' });
    }
};

export const verifyOrder = async (req, res) => {
    try {
        const { orderId, demo } = req.body;
        const order = await Order.findOne({ orderId });
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

        if (order.status === 'confirmed') return res.json({ success: true, paid: true, order });

        let isPaid = false;
        const config = getCashfreeConfig();

        if (config.APP_ID && order.cfOrderId) {
            try {
                const statusRes = await axios.get(`${config.BASE_URL}/orders/${orderId}`, { headers: config.HEADERS });
                if (statusRes.data.order_status === 'PAID') isPaid = true;
            } catch (e) {}
        }

        if (String(demo) === 'true') isPaid = true;

        if (isPaid) {
            order.status = 'confirmed';
            order.paidAt = new Date();
            await order.save();
            await bookSlotInternal(order.booking.date, order.booking.location, order.booking.slotId, order.booking.package);
        }

        res.json({ success: true, paid: order.status === 'confirmed', order });

    } catch (error) {
        res.status(500).json({ success: false, message: 'Verification Error' });
    }
};

export const getOrder = async (req, res) => {
    const order = await Order.findOne({ orderId: req.params.orderId });
    if (!order) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, order });
};

export const getUserOrders = async (req, res) => {
    const phone = String(req.query.phone).replace(/\D/g, '');
    const orders = await Order.find({ 'customer.phone': phone }).sort({ createdAt: -1 });
    res.json({ success: true, orders, count: orders.length });
};

export const cancelOrder = async (req, res) => {
    const { orderId, phone, reason } = req.body;
    const order = await Order.findOne({ orderId });
    if (!order) return res.status(404).json({ success: false });

    if (phone) {
        if (order.customer.phone !== String(phone).replace(/\D/g, '')) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }
    }

    if (order.status === 'cancelled') return res.status(400).json({ success: false });

    order.status = 'cancelled';
    order.cancelledAt = new Date();
    order.cancellationReason = reason;
    await order.save();
    
    await freeSlotInternal(order.booking.date, order.booking.location, order.booking.slotId, order.booking.package);
    
    res.json({ success: true, message: 'Cancelled', order });
};

export const paymentWebhook = async (req, res) => {
    try {
        const data = req.body.data || req.body;
        const orderId = data.order?.order_id;
        const status = data.payment?.payment_status;
        const type = data.type;

        if (orderId && (status === 'SUCCESS' || type === 'PAYMENT_SUCCESS_WEBHOOK')) {
            const order = await Order.findOne({ orderId });
            if (order && order.status !== 'confirmed') {
                order.status = 'confirmed';
                order.paidAt = new Date();
                await order.save();
                await bookSlotInternal(order.booking.date, order.booking.location, order.booking.slotId, order.booking.package);
                console.log(`Webhook: Order ${orderId} confirmed`);
            }
        }
        res.json({ received: true });
    } catch (e) {
        res.json({ received: true });
    }
};
