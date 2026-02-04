import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import User from '../models/User.js';
import Order from '../models/Order.js';
import BookedSlot from '../models/BookedSlot.js';
import { getSlotKey } from './helpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../data');

const seedData = async () => {
  try {
    // 1. Migrate Users
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      if (fs.existsSync(path.join(DATA_DIR, 'users.json'))) {
        const users = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'users.json'), 'utf-8'));
        if (Array.isArray(users) && users.length > 0) {
          await User.insertMany(users);
          console.log(`✅ Migrated ${users.length} users from JSON`);
        }
      }
    }

    // 2. Migrate Orders
    const orderCount = await Order.countDocuments();
    if (orderCount === 0) {
      if (fs.existsSync(path.join(DATA_DIR, 'orders.json'))) {
        const orders = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'orders.json'), 'utf-8'));
        if (Array.isArray(orders) && orders.length > 0) {
          await Order.insertMany(orders);
          console.log(`✅ Migrated ${orders.length} orders from JSON`);
        }
      }
    }

    // 3. Migrate Slots
    const slotCount = await BookedSlot.countDocuments();
    if (slotCount === 0) {
      if (fs.existsSync(path.join(DATA_DIR, 'slots.json'))) {
        const rawSlots = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'slots.json'), 'utf-8'));
        // Format: { "YYYY-MM-DD_Location": ["slot-1"] } or similar keys
        
        const slotDocs = Object.keys(rawSlots).map(key => {
          const parts = key.split('_'); // Assuming key is either date_loc or loc_date. 
          // Previous server.js helper was `${date}_${location}`.
          // IF the key is "2026-02-02_Ahmedabad".
          // We need to parse this.
          // However, since slots.json is empty in the user's workspace, this code won't actually run on data.
          // But for robustness:
          
          let date, location;
          // Simple heuristic: Date has numbers, Location has letters.
          if (parts[0].match(/^\d/)) {
             date = parts[0];
             location = parts[1];
          } else {
             location = parts[0];
             date = parts[1];
          }

          return {
            key: key, 
            location: location,
            date: date,
            bookedSlotIds: rawSlots[key]
          };
        });

        if (slotDocs.length > 0) {
          await BookedSlot.insertMany(slotDocs);
          console.log(`✅ Migrated ${slotDocs.length} booked slot records from JSON`);
        }
      }
    }

  } catch (error) {
    console.error('❌ Data Migration Error:', error);
  }
};

export { seedData };
