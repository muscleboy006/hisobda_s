const mongoose = require('mongoose');

const debtPaymentSchema = new mongoose.Schema({
  debtId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Debt',
    required: true
  },
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
  amount: {
    type: mongoose.Schema.Types.Decimal128,
    required: true  
  },
  paidAt: {
    type: Date,
    default: Date.now
  }
});

debtPaymentSchema.index({ userId: 1, debtId: 1, paidAt: -1 });

module.exports = mongoose.model('DebtPayment', debtPaymentSchema);
