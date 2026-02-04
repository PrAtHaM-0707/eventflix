import express from 'express';
import { getSlots, checkSlot } from '../controllers/slotController.js';

const router = express.Router();

router.get('/', getSlots);
router.get('/check', checkSlot);

export default router;
