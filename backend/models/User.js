import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  id: { type: String, unique: true }, // Legacy ID format
  phone: { type: String, required: true, unique: true },
  name: String,
  lastLogin: Date,
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('User', userSchema);
