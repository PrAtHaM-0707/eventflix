import express from 'express';
import { 
    loginAdmin, 
    getStats, 
    getAdminOrders, 
    updateOrderStatus
} from '../controllers/adminController.js';

const router = express.Router();

// Public route (login)
router.post('/login', loginAdmin);

// Protected routes (add middleware here if you want real security)
router.get('/stats', getStats);
router.get('/orders', getAdminOrders);
router.put('/orders/:orderId', updateOrderStatus);
router.put('/orders/:orderId/status', updateOrderStatus); 
export default router;
