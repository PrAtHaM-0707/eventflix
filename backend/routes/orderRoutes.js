import express from 'express';
import { createOrder, verifyOrder, getOrder, getUserOrders, cancelOrder } from '../controllers/orderController.js';

const router = express.Router();

router.post('/create', createOrder);
router.post('/verify', verifyOrder);
router.post('/cancel', cancelOrder);
router.get('/:orderId', getOrder);
router.get('/', getUserOrders); // api/orders?phone=...

export default router;
