const Decimal = require('decimal.js');
const DebtPayment = require('../models/DebtPayment');
const Debt = require('../models/Debt');
const Wallet = require('../models/Wallet');
const User = require('../models/User');

// Yaratish
exports.createPayment = async (req, res) => {
  try {
    const { debtId } = req.params;
    const { amount } = req.body;
    const userId = req.user.id;

    // Validate amount is a valid number
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: "Tolov summasi yaroqli musbat raqam bolishi kerak." });
    }

    const debt = await Debt.findOne({ _id: debtId, userId });
    if (!debt) return res.status(404).json({ error: 'Qarz topilmadi.' });
    
    if (debt.status === 'paid') {
      return res.status(400).json({ error: 'Qarz allaqachon tolangan.' });
    }

    const wallet = await Wallet.findById(debt.walletId);
    if (!wallet) return res.status(404).json({ error: 'Kassa topilmadi.' });

    // Ensure all values are properly handled
    const amountDecimal = new Decimal(amount.toString());
    
    // Handle null or undefined paidAmount safely
    const paidAmount = debt.paidAmount ? new Decimal(debt.paidAmount.toString()) : new Decimal('0');
    
    // Ensure debt amount is valid
    if (!debt.amount) {
      return res.status(400).json({ error: 'Qarz summasi yaroqli emas.' });
    }
    const debtAmount = new Decimal(debt.amount.toString());
    
    const remaining = debtAmount.minus(paidAmount);

    // Check if payment amount is valid
    if (amountDecimal.lte(0)) {
      return res.status(400).json({ error: "Tolov summasi musbat bolishi kerak." });
    }

    if (amountDecimal.gt(remaining)) {
      return res.status(400).json({ error: `Tolov summasi ${remaining.toString()} dan oshmasligi kerak.` });
    }

    // Validate wallet balance
    if (wallet.balance === undefined || wallet.balance === null) {
      return res.status(400).json({ error: 'Kassa balansi togri emas.' });
    }
    
    let walletBalance = new Decimal(wallet.balance.toString());

    if (debt.type === 'taken') {
      if (walletBalance.lt(amountDecimal)) {
        return res.status(400).json({ error: 'Kassada mablag yetarli emas.' });
      }
      walletBalance = walletBalance.minus(amountDecimal);
    } else {
      walletBalance = walletBalance.plus(amountDecimal);
    }

    // Create the payment record first
    const payment = await DebtPayment.create({
      debtId,
      userId,
      walletId: wallet._id,
      amount: amountDecimal.toString(),
      paidAt: new Date()
    });

    await User.findByIdAndUpdate(userId, { $inc: { dataCount: 1 } })

    // Update the wallet balance
    wallet.balance = walletBalance.toString();
    await wallet.save();

    // Update the debt paidAmount
    const newPaidAmount = paidAmount.plus(amountDecimal);
    debt.paidAmount = newPaidAmount.toString();
    
    // Check if debt is fully paid
    if (newPaidAmount.gte(debtAmount)) {
      debt.status = 'paid';
      debt.paidAt = new Date();
    }

    // Save the updated debt
    await debt.save();

    console.log(`Payment created: Amount ${amountDecimal}, New Paid Amount: ${debt.paidAmount}, Status: ${debt.status}`);
    
    res.status(201).json({
      payment,
      debt: {
        id: debt._id,
        paidAmount: debt.paidAmount,
        status: debt.status
      }
    });
  } catch (err) {
    console.error('Payment creation error:', err.message, err.stack);
    res.status(500).json({ error: 'Tolov yaratishda xatolik.' });
  }
};

// Barchasini olish
exports.getPayments = async (req, res) => {
  try {
    const payments = await DebtPayment.find({ userId: req.user.id }).sort({ paidAt: -1 });
    res.json(payments);
  } catch (err) {
    console.error('Get payments error:', err.message);
    res.status(500).json({ error: 'Tolovlarni olishda xatolik.' });
  }
};

// Tolovni olish (id boyicha)
exports.getPayment = async (req, res) => {
  try {
    const payment = await DebtPayment.findOne({ _id: req.params.id, userId: req.user.id });
    if (!payment) return res.status(404).json({ error: 'Tolov topilmadi.' });
    res.json(payment);
  } catch (err) {
    console.error('Get payment error:', err.message);
    res.status(500).json({ error: 'Tolovni olishda xatolik.' });
  }
};

// Debt payments for a specific debt
exports.getDebtPayments = async (req, res) => {
  try {
    const { debtId } = req.params;
    const payments = await DebtPayment.find({ 
      debtId, 
      userId: req.user.id 
    }).sort({ paidAt: -1 });
    
    res.json(payments);
  } catch (err) {
    console.error('Get debt payments error:', err.message);
    res.status(500).json({ error: 'Qarz tolovlarini olishda xatolik.' });
  }
};

// ochirish
exports.deletePayment = async (req, res) => {
  try {
    const payment = await DebtPayment.findOne({ _id: req.params.id, userId: req.user.id });
    if (!payment) return res.status(404).json({ error: 'Tolov topilmadi.' });

    const debt = await Debt.findOne({ _id: payment.debtId, userId: req.user.id });
    const wallet = await Wallet.findOne({ _id: payment.walletId, userId: req.user.id });

    if (!debt || !wallet) return res.status(400).json({ error: 'Boglangan malumotlar topilmadi.' });

    // Validate payment amount
    if (!payment.amount) {
      return res.status(400).json({ error: 'Tolov summasi yaroqli emas.' });
    }
    const amountDecimal = new Decimal(payment.amount.toString());
    
    // Validate debt paid amount
    if (debt.paidAmount === undefined || debt.paidAmount === null) {
      return res.status(400).json({ error: 'Qarz tolangan summasi yaroqli emas.' });
    }
    let paidAmount = new Decimal(debt.paidAmount.toString());
    
    // Validate wallet balance
    if (wallet.balance === undefined || wallet.balance === null) {
      return res.status(400).json({ error: 'Kassa balansi togri emas.' });
    }
    let walletBalance = new Decimal(wallet.balance.toString());

    // Update paid amount
    paidAmount = paidAmount.minus(amountDecimal);
    debt.paidAmount = paidAmount.toString();

    // Check if debt is still unpaid
    if (!debt.amount) {
      return res.status(400).json({ error: 'Qarz summasi yaroqli emas.' });
    }
    if (paidAmount.lt(new Decimal(debt.amount.toString()))) {
      debt.status = 'unpaid';
      debt.paidAt = null;
    }

    // Update wallet balance
    if (debt.type === 'taken') {
      walletBalance = walletBalance.plus(amountDecimal);
    } else {
      if (walletBalance.lt(amountDecimal)) {
        return res.status(400).json({ error: 'Kassada yetarli mablag yoq, tolovni ochirish mumkin emas.' });
      }
      walletBalance = walletBalance.minus(amountDecimal);
    }

    wallet.balance = walletBalance.toString();

    // Save all changes
    await Promise.all([
      debt.save(),
      wallet.save(),
      payment.deleteOne()
    ]);

    res.json({ 
      message: 'Tolov ochirildi va balans yangilandi.',
      debt: {
        id: debt._id,
        paidAmount: debt.paidAmount,
        status: debt.status
      }
    });
  } catch (err) {
    console.error('Delete payment error:', err.message, err.stack);
    res.status(500).json({ error: 'Tolovni ochirishda xatolik.' });
  }
};