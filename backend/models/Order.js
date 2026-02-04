import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  orderId: { type: String, unique: true, required: true },
  customer: {
    name: String,
    phone: String,
    email: String
  },
  booking: {
    location: String,
    date: String,
    slotId: String,
    slotLabel: String,
    package: String,
    packagePrice: Number,
    features: [String]
  },
  amount: Number,
  status: { type: String, default: 'pending' }, // pending, confirmed, cancelled, failed
  paymentSessionId: String,
  cfOrderId: String,
  paymentReference: String,
  paidAt: Date,
  cancelledAt: Date,
  cancellationReason: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: Date
});

export default mongoose.model('Order', orderSchema);
