const mongoose = require('mongoose');

const debtSchema = new mongoose.Schema({
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
    enum: ['given', 'taken'], // berilgan yoki olingan
    required: true
  },
  amount: {
    type: mongoose.Schema.Types.Decimal128,
    required: true
  },
  paidAmount: {
    type: mongoose.Schema.Types.Decimal128,
    default: '0'
  },
  person: {
    type: String, // Kimga yoki kimdan
    required: true
  },
  note: {
    type: String
  },
  status: {
    type: String,
    enum: ['unpaid', 'paid'],
    default: 'unpaid'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  paidAt: {
    type: Date // Qarz to'langan vaqti
  }
});

// ✅ Индекс на пользователя и дату
debtSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Debt', debtSchema);
