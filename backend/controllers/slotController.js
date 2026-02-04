import BookedSlot from '../models/BookedSlot.js';
import { TIME_SLOTS } from '../data/constants.js';
import { getSlotKey, formatDate } from '../utils/helpers.js';

export const getSlots = async (req, res) => {
  try {
    const { date, location } = req.query;
    if (!date || !location) {
        return res.status(400).json({ success: false, message: 'Date/Location required' });
    }

    // New logic: Fetch bookings for ALL packages on this date/location
    const allBookings = await BookedSlot.find({ date, location });
    
    // Create a map of booked slots per package (e.g. { 'Silver': ['slot-1'], 'Gold': [] })
    const bookedMap = {};
    const globalBookings = []; // For legacy data or "global" blocks

    allBookings.forEach(doc => {
       const parts = doc.key.split('_');
       // Key format: date_location_package OR date_location (legacy)
       // If parts length > 2, the 3rd part is package (assuming location doesn't have underscore)
       // But location names like "New_York" could break this status quo.
       // Safest: The key is constructed as `${date}_{location}_{pkg}`.
       // However, we rely on the `location` field in DB? Yes.
       // But `BookedSlot` schema allows storing arbitrary keys. 
       
       // Let's rely on finding if key ends with `_${pkg}` or we just send everything to frontend?
       // Easier: Just return the raw map of "package -> bookedIds"
       
       // Heuristic:
       // date = "2026-02-04" (10 chars)
       // key starts with date usually (from helper).
       
       if (doc.key === `${date}_${location}`) {
           globalBookings.push(...doc.bookedSlotIds);
       } else {
           const suffix = doc.key.replace(`${date}_${location}_`, '');
           if (suffix && suffix !== doc.key) {
               if (!bookedMap[suffix]) bookedMap[suffix] = [];
               bookedMap[suffix].push(...doc.bookedSlotIds);
           }
       }
    });

    res.json({
        success: true,
        date,
        location,
        formattedDate: formatDate(date),
        bookedMap, 
        globalBookings,
        timeSlots: TIME_SLOTS // Send slot definitions so frontend can render
    });

  } catch (error) {
    console.error('Get Slots Error:', error);
    res.status(500).json({ success: false, message: 'Failed' });
  }
};

export const checkSlot = async (req, res) => {
    try {
        const { date, location, slotId, package: pkg } = req.query; // 'package' is reserved word? no
        if (!date || !location || !slotId) return res.status(400).json({ success: false, message: 'Missing params' });

        // Check Global (Legacy)
        const globalKey = getSlotKey(date, location);
        const globalDoc = await BookedSlot.findOne({ key: globalKey });
        if (globalDoc && globalDoc.bookedSlotIds.includes(slotId)) {
             return res.json({ success: true, slotId, available: false, booked: true });
        }

        // Check Package Specific
        if (pkg) {
            const pkgKey = getSlotKey(date, location, pkg);
            const pkgDoc = await BookedSlot.findOne({ key: pkgKey });
            if (pkgDoc && pkgDoc.bookedSlotIds.includes(slotId)) {
                return res.json({ success: true, slotId, available: false, booked: true });
            }
        }

        res.json({ success: true, slotId, available: true, booked: false });

    } catch (error) {
        res.status(500).json({ success: false, message: 'Error checking slot' });
    }
};

export const bookSlotInternal = async (date, location, slotId, pkg) => {
    try {
        const slotKey = getSlotKey(date, location, pkg); // If pkg is null, locks globally (legacy/resource)
        await BookedSlot.findOneAndUpdate(
            { key: slotKey },
            { 
               $setOnInsert: { location, date },
               $addToSet: { bookedSlotIds: slotId }
            },
            { upsert: true, new: true }
        );
        return true;
    } catch (error) {
        console.error('Book Slot Internal Error:', error);
        return false;
    }
};

export const freeSlotInternal = async (date, location, slotId, pkg) => {
    try {
        const slotKey = getSlotKey(date, location, pkg);
        await BookedSlot.updateOne(
            { key: slotKey },
            { $pull: { bookedSlotIds: slotId } }
        );
        return true;
    } catch (error) {
        return false;
    }
};
