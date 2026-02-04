import mongoose from 'mongoose';

const bookedSlotSchema = new mongoose.Schema({
  key: { type: String, unique: true, required: true }, // Format: "Location_YYYY-MM-DD" // Actually server.js uses location_date so I should verify expected format.
                                                       // server.js: getSlotKey(date, location) => `${location}_${date}`
                                                       // Wait, server.js getSlotKey was `${date}_${location}` in helper function but `${location}_${date}` in Mongoose section?
                                                       // Let me check.
  location: String,
  date: String,
  bookedSlotIds: [String]
});

export default mongoose.model('BookedSlot', bookedSlotSchema);
