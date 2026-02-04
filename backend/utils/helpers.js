import crypto from 'crypto';

export const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const generateOrderId = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `EF${timestamp}${random}`;
};

export const generateToken = (userId) => {
  return crypto.createHash('sha256')
    .update(userId + Date.now().toString() + crypto.randomBytes(16).toString('hex'))
    .digest('hex');
};

export const getSlotKey = (date, location, pkg) => {
  if (pkg) return `${date}_${location}_${pkg}`;
  return `${date}_${location}`;
};

export const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
};
