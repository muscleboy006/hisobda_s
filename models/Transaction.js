const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  walletId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wallet',
    required: true
  },
  type: {
    type: String,
    enum: ['income', 'expense'],
    required: true
  },
  amount: {
    type: mongoose.Schema.Types.Decimal128,
    required: true,
    min: 0
  },
  category: {
    type: String,
    default: 'General'
  },
  note: {
    type: String,
    default: ''
  },
  date: {
    type: Date,
    default: Date.now
  }
});

// ✅ Составной индекс для оптимизации запроса
transactionSchema.index({ userId: 1, walletId: 1, date: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);