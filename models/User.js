// файл: server/models/User.js
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  telegramId: {
    type: String,
    required: true,
    unique: true
  },
  first_name: {
    type: String,
    required: true
  },
  last_name: {
    type: String,
    default: ''
  },
  username: {
    type: String,
    default: ''
  },
  photo_url: {
    type: String,
    default: ''
  },
  auth_date: {
    type: Number,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
  dataCount: {
    type: Number,
    default: 0
  },
  premiumEndsAt: {
    type: Date,
    default: () => new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 7 дней с момента регистрации
  },
  referrals: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
});

module.exports = mongoose.model('User', UserSchema);