const Transaction = require('../models/Transaction');
const Wallet = require('../models/Wallet');
const mongoose = require('mongoose');
const Decimal = require('decimal.js');

// ➕ Qo‘shish
exports.addTransaction = async (req, res) => {
  try {
    const { walletId, type, amount, category, note, date } = req.body;
    const userId = req.user.id;

    const wallet = await Wallet.findOne({ _id: walletId, userId });
    if (!wallet) return res.status(404).json({ error: 'Kassa topilmadi.' });

    const currentBalance = new Decimal(wallet.balance.toString());
    const transactionAmount = new Decimal(amount);

    const newBalance = type === 'income'
      ? currentBalance.plus(transactionAmount)
      : currentBalance.minus(transactionAmount);

    if (newBalance.isNegative()) return res.status(400).json({ error: 'Balans manfiy bo‘lishi mumkin emas.' });

    const transaction = await Transaction.create({
      userId,
      walletId,
      type,
      amount: mongoose.Types.Decimal128.fromString(transactionAmount.toString()),
      category,
      note,
      date
    });

    wallet.balance = mongoose.Types.Decimal128.fromString(newBalance.toString());
    await wallet.save();

    res.status(201).json({ message: 'Tranzaksiya qo‘shildi.', transaction });
  } catch (error) {
    res.status(500).json({ error: 'Serverda xatolik yuz berdi.' });
  }
};

// 📥 Barcha tranzaksiyalarni olish
exports.getAllTransactions = async (req, res) => {
  try {
    const userId = req.user.id;
    const { walletId, limit = 50, skip = 0, period = 'Bu oy', startDate, endDate, search, category } = req.query;

    const query = { userId: new mongoose.Types.ObjectId(userId) };
    if (walletId) query.walletId = walletId;

    // Фильтрация по дате
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    } else {
      const dateFilter = getPeriodRange(period);
      if (Object.keys(dateFilter).length > 0) query.date = dateFilter;
    }

    // Фильтрация по поисковому запросу (note) и категории
    if (search || category) {
      if (search) {
        const searchRegex = new RegExp(search, 'i'); // Case-insensitive search for note
        query.note = { $regex: searchRegex };
      }
      if (category) {
        query.category = category; // Exact match for category
      }
    }

    let transactions;
    let hasMore = false;

    if (search || category) {
      // При поиске или фильтрации по категории игнорируем limit и skip
      transactions = await Transaction.find(query)
        .sort({ date: -1 })
        .select('_id type amount category note date')
        .lean();
    } else {
      // Обычный запрос с пагинацией
      const parsedLimit = parseInt(limit);
      const parsedSkip = parseInt(skip);

      transactions = await Transaction.find(query)
        .sort({ date: -1 })
        .limit(parsedLimit + 1)
        .skip(parsedSkip)
        .select('_id type amount category note date')
        .lean();

      hasMore = transactions.length > parsedLimit;
      if (hasMore) transactions.pop();
    }

    res.json({
      transactions,
      hasMore
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Tranzaksiyalarni olishda xatolik.' });
  }
};

// 🔎 Get a single transaction by ID
exports.getTransaction = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const transaction = await Transaction.findOne({ _id: id, userId });
    if (!transaction) {
      return res.status(404).json({ error: 'Tranzaksiya topilmadi.' });
    }

    res.json({ transaction });
  } catch (error) {
    console.error('Get transaction error:', error);
    res.status(500).json({ error: 'Serverda xatolik yuz berdi.' });
  }
};

// 🔄 Update existing transaction
exports.updateTransaction = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const { type, amount, category, note, date } = req.body;

  try {
    // 1. Find original transaction
    const origTx = await Transaction.findOne({ _id: id, userId });
    if (!origTx) return res.status(404).json({ error: 'Tranzaksiya topilmadi.' });

    // 2. Find wallet (unchanged walletId assumed)
    const wallet = await Wallet.findOne({ _id: origTx.walletId, userId });
    if (!wallet) return res.status(404).json({ error: 'Kassa topilmadi.' });

    // 3. Revert original impact on balance
    let balance = new Decimal(wallet.balance.toString());
    const origAmt = new Decimal(origTx.amount.toString());
    balance = origTx.type === 'income'
      ? balance.minus(origAmt)
      : balance.plus(origAmt);

    // 4. Determine new values (fallback to original if not provided)
    const newType = type ?? origTx.type;
    const newAmtDecimal = amount !== undefined
      ? new Decimal(amount)
      : origAmt;

    // 5. Apply new transaction effect
    balance = newType === 'income'
      ? balance.plus(newAmtDecimal)
      : balance.minus(newAmtDecimal);

    // 6. Prevent negative balance
    if (balance.isNegative()) {
      return res.status(400).json({ error: 'Balans manfiy bo‘lishi mumkin emas.' });
    }

    // 7. Update fields only if provided
    if (type !== undefined) origTx.type = newType;
    if (amount !== undefined) origTx.amount = mongoose.Types.Decimal128.fromString(newAmtDecimal.toString());
    if (category !== undefined) origTx.category = category;
    if (note !== undefined) origTx.note = note;
    if (date !== undefined) origTx.date = date;

    await origTx.save();

    // 8. Persist new balance
    wallet.balance = mongoose.Types.Decimal128.fromString(balance.toString());
    await wallet.save();

    res.json({ message: 'Tranzaksiya yangilandi.', transaction: origTx });
  } catch (error) {
    console.error('Update transaction error:', error);
    res.status(500).json({ error: 'Serverda xatolik yuz berdi.' });
  }
}

// ❌ O‘chirish
exports.deleteTransaction = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const transaction = await Transaction.findOne({ _id: id, userId });
    if (!transaction) return res.status(404).json({ error: 'Tranzaksiya topilmadi.' });

    const wallet = await Wallet.findOne({ _id: transaction.walletId, userId });
    if (!wallet) return res.status(404).json({ error: 'Kassa topilmadi.' });

    const currentBalance = new Decimal(wallet.balance.toString());
    const transactionAmount = new Decimal(transaction.amount.toString());

    const revert = transaction.type === 'income'
      ? currentBalance.minus(transactionAmount)
      : currentBalance.plus(transactionAmount);

    wallet.balance = mongoose.Types.Decimal128.fromString(revert.toString());
    await wallet.save();

    await transaction.deleteOne();

    res.json({ message: 'Tranzaksiya o‘chirildi.' });
  } catch (error) {
    res.status(500).json({ error: 'Tranzaksiyani o‘chirishda xatolik.' });
  }
};

const getPeriodRange = (period) => {
  const now = new Date();
  const tzOffset = 5 * 60; // Asia/Tashkent UTC+5 в минутах

  // Текущий момент со смещением (локальное время)
  const localNow = new Date(now.getTime() + tzOffset * 60 * 1000);

  const getLocalStart = (unit) => {
    const date = new Date(localNow);
    switch (unit) {
      case 'day':
        date.setHours(0, 0, 0, 0);
        break;
      case 'week': {
        const day = (date.getDay() + 6) % 7; // Monday = 0
        date.setDate(date.getDate() - day);
        date.setHours(0, 0, 0, 0);
        break;
      }
      case 'month':
        date.setDate(1);
        date.setHours(0, 0, 0, 0);
        break;
      case 'year':
        date.setMonth(0, 1);
        date.setHours(0, 0, 0, 0);
        break;
    }
    // Переводим обратно в UTC
    return new Date(date.getTime() - tzOffset * 60 * 1000);
  };

  switch (period) {
    case 'Bugun':
      return {
        $gte: getLocalStart('day'),
        $lte: now
      };
    case 'Bu hafta':
      return {
        $gte: getLocalStart('week'),
        $lte: now
      };
    case 'Bu oy':
      return {
        $gte: getLocalStart('month'),
        $lte: now
      };
    case 'Bu yil':
      return {
        $gte: getLocalStart('year'),
        $lte: now
      };
    default:
      return {};
  }
};



exports.getSummary = async (req, res) => {
  try {
    const userId = req.user.id;
    const period = req.query.period || 'Bu oy';
    const dateFilter = getPeriodRange(period);

    const match = { userId: new mongoose.Types.ObjectId(userId) };
    if (Object.keys(dateFilter).length > 0) {
      match.date = dateFilter;
    }

    const results = await Transaction.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$type',
          total: { $sum: { $toDouble: '$amount' } }
        }
      }
    ]);

    let income = 0;
    let expense = 0;
    results.forEach(r => {
      if (r._id === 'income') income = r.total;
      if (r._id === 'expense') expense = r.total;
    });

    res.json({ income, expense });
  } catch (err) {
    console.error('getSummary error:', err);
    res.status(500).json({ error: 'Statistikani olishda xatolik.' });
  }
};

exports.searchTransactions = async (req, res) => {
  try {
    const userId = req.user.id;
    const { walletId, period = 'Bu oy', startDate, endDate, search, category } = req.query;

    const query = { userId: new mongoose.Types.ObjectId(userId) };
    if (walletId) query.walletId = walletId;

    // Фильтрация по дате
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    } else {
      const dateFilter = getPeriodRange(period);
      if (Object.keys(dateFilter).length > 0) query.date = dateFilter;
    }

    // Фильтрация по поисковому запросу (note) и категории
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.note = { $regex: searchRegex };
    }
    if (category) {
      query.category = category;
    }

    const transactions = await Transaction.find(query)
      .sort({ date: -1 })
      .select('_id type amount category note date')
      .lean();

    res.json({
      transactions,
      hasMore: false
    });
  } catch (error) {
    console.error('Error searching transactions:', error);
    res.status(500).json({ error: 'Tranzaksiyalarni qidirishda xatolik.' });
  }
};