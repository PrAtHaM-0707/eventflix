import express from 'express';
import { getLocations, getPackages } from '../controllers/packageController.js';

const router = express.Router();

router.get('/locations', getLocations);
router.get('/packages/:location', getPackages);

export default router;
