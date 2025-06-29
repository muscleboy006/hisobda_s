const Debt = require('../models/Debt');
const DebtPayment = require('../models/DebtPayment');
const Wallet = require('../models/Wallet');
const Decimal = require('decimal.js');
const mongoose = require('mongoose');

exports.createDebt = async (req, res) => {
  try {
    const { type, amount, person, note } = req.body;
    const userId = req.user.id;

    const walletId = await Wallet.findOne({ userId })

    // Validate inputs
    if (!amount || isNaN(parseFloat(amount))) {
      return res.status(400).json({ error: 'Qarz summasi yaroqli raqam bolishi kerak.' });
    }

    if (!['given', 'taken'].includes(type)) {
      return res.status(400).json({ error: 'Notogri qarz turi.' });
    }

    const wallet = await Wallet.findById(walletId);
    if (!wallet) {
      return res.status(404).json({ error: 'Kassa topilmadi' });
    }

    // Ensure wallet balance is valid
    if (wallet.balance === undefined || wallet.balance === null) {
      return res.status(400).json({ error: 'Kassa balansi togri emas.' });
    }
    
    // Safe conversion to Decimal
    const walletBalance = new Decimal(wallet.balance.toString());
    const amountDecimal = new Decimal(amount.toString());

    if (type === 'given' && walletBalance.lessThan(amountDecimal)) {
      return res.status(400).json({ error: 'Yetarli mablag mavjud emas.' });
    }

    const newBalance = type === 'taken'
      ? walletBalance.plus(amountDecimal)
      : walletBalance.minus(amountDecimal);

    wallet.balance = newBalance.toString();
    await wallet.save();

    const debt = await Debt.create({
      userId,
      walletId,
      type,
      amount: amountDecimal.toString(),
      person,
      note
    });

    res.status(201).json(debt);
  } catch (err) {
    console.error('Debt creation error:', err.message, err.stack);
    res.status(500).json({ error: 'Qarz yaratishda xatolik.' });
  }
};

// Olish с пагинацией
// GET /api/debt?walletId=&limit=&skip=&period=&startDate=&endDate=&status=&type=&person=
exports.getDebts = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      limit = 50,
      skip = 0,
      period = 'Bu oy',
      startDate,
      endDate,
      status,
      type,
      person
    } = req.query;

    const query = {
      userId: new mongoose.Types.ObjectId(userId)
    };

    // Фильтрация по статусу
    if (status && ['active', 'paid'].includes(status)) {
      query.status = status;
    }

    // Фильтрация по типу
    if (type && ['given', 'taken'].includes(type)) {
      query.type = type;
    }

    // Фильтрация по человеку
    if (person) {
      query.person = { $regex: person, $options: 'i' };
    }

    const parsedLimit = parseInt(limit);
    const parsedSkip = parseInt(skip);

    const debts = await Debt.find(query)
      .sort({ createdAt: -1 })
      .limit(parsedLimit + 1) // на 1 больше, чтобы узнать hasMore
      .skip(parsedSkip)
      .select('person amount paidAmount type status createdAt') // выбираем только нужное
      .lean();

    // Обработка Decimal128 и форматирование
    const cleanedDebts = debts.slice(0, parsedLimit).map(debt => ({
      ...debt,
      amount: parseFloat(debt.amount?.$numberDecimal || debt.amount || 0),
      paidAmount: parseFloat(debt.paidAmount?.$numberDecimal || debt.paidAmount || 0),
      createdAt: new Date(debt.createdAt).toISOString(),
    }));

    res.json({
      debts: cleanedDebts,
      hasMore: debts.length > parsedLimit
    });
    
    console.log(debts.length, parsedLimit);
    
  } catch (err) {
    console.error('Get debts error:', err.message);
    res.status(500).json({ error: 'Qarzlarni olishda xatolik.' });
  }
};

// Bitta qarzni olish с частичными погашениями
exports.getDebtById = async (req, res) => {
  try {
    // Находим основную информацию о долге
    const debt = await Debt.findOne({ _id: req.params.id, userId: req.user.id });
    if (!debt) {
      return res.status(404).json({ error: 'Qarz topilmadi.' });
    }

    const { limit = 50, skip = 0 } = req.query;

    // Находим частичные погашения для этого долга с пагинацией
    const totalPayments = await DebtPayment.countDocuments({ 
      debtId: req.params.id, 
      userId: req.user.id 
    });
    
    const payments = await DebtPayment.find({ 
      debtId: req.params.id, 
      userId: req.user.id 
    })
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip(parseInt(skip))
    .lean();

    // Возвращаем объект с информацией о долге и массивом погашений
    res.json({
      debt,
      payments,
      totalPayments,
      hasMore: parseInt(skip) + parseInt(limit) < totalPayments
    });
  } catch (err) {
    console.error('Get debt by ID error:', err.message);
    res.status(500).json({ error: 'Qarz olishda xatolik.' });
  }
};

exports.updateDebt = async (req, res) => {
  try {
    const { type, amount, person, note } = req.body;
    const userId = req.user.id;

    // Validate amount if provided
    if (amount !== undefined && (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0)) {
      return res.status(400).json({ error: 'Qarz summasi yaroqli raqam bolishi kerak.' });
    }

    const debt = await Debt.findOne({ _id: req.params.id, userId });
    if (!debt) {
      return res.status(404).json({ error: 'Qarz topilmadi.' });
    }

    if (debt.status === 'paid') {
      return res.status(400).json({ error: 'Tolangan qarzni ozgartirib bolmaydi.' });
    }

    const wallet = await Wallet.findById(debt.walletId);
    if (!wallet) return res.status(404).json({ error: 'Kassa topilmadi' });

    // Ensure debt amount and wallet balance are valid
    if (!debt.amount) {
      return res.status(400).json({ error: 'Mavjud qarz summasi yaroqli emas.' });
    }

    if (wallet.balance === undefined || wallet.balance === null) {
      return res.status(400).json({ error: 'Kassa balansi togri emas.' });
    }

    const oldAmount = new Decimal(debt.amount.toString());
    const newAmount = amount !== undefined ? new Decimal(amount.toString()) : oldAmount;
    const oldType = debt.type;
    const newType = type || oldType;
    let balance = new Decimal(wallet.balance.toString());

    // Возвращаем старое значение
    if (oldType === 'taken') {
      balance = balance.minus(oldAmount);
    } else {
      balance = balance.plus(oldAmount);
    }

    // Применяем новое значение
    if (newType === 'taken') {
      balance = balance.plus(newAmount);
    } else {
      if (balance.lessThan(newAmount)) {
        return res.status(400).json({ error: 'Yetarli mablag mavjud emas.' });
      }
      balance = balance.minus(newAmount);
    }

    wallet.balance = balance.toString();
    await wallet.save();

    if (type && !['given', 'taken'].includes(type)) {
      return res.status(400).json({ error: 'Notogri qarz turi.' });
    }

    if (type) debt.type = type;
    if (amount !== undefined) debt.amount = newAmount.toString();
    if (person !== undefined) debt.person = person;
    if (note !== undefined) debt.note = note;

    await debt.save();
    res.json(debt);
  } catch (err) {
    console.error('Update debt error:', err.message, err.stack);
    res.status(500).json({ error: 'Qarzni tahrirlashda xatolik.' });
  }
};

// Tolandi
exports.markAsPaid = async (req, res) => {
  try {
    const debt = await Debt.findOne({ _id: req.params.id, userId: req.user.id });
    if (!debt) return res.status(404).json({ error: 'Qarz topilmadi.' });

    if (debt.status === 'paid') return res.status(400).json({ error: 'Qarz allaqachon tolangan.' });

    const wallet = await Wallet.findById(debt.walletId);
    if (!wallet) return res.status(404).json({ error: 'Kassa topilmadi.' });

    // Validate debt amount and wallet balance
    if (!debt.amount) {
      return res.status(400).json({ error: 'Qarz summasi yaroqli emas.' });
    }

    if (wallet.balance === undefined || wallet.balance === null) {
      return res.status(400).json({ error: 'Kassa balansi togri emas.' });
    }

    const amount = new Decimal(debt.amount.toString());
    let balance = new Decimal(wallet.balance.toString());

    if (debt.type === 'taken') {
      balance = balance.minus(amount);
    } else {
      balance = balance.plus(amount);
    }

    wallet.balance = balance.toString();
    await wallet.save();

    debt.status = 'paid';
    debt.paidAt = new Date();
    await debt.save();

    res.json(debt);
  } catch (err) {
    console.error('Mark as paid error:', err.message, err.stack);
    res.status(500).json({ error: 'Tolashda xatolik yuz berdi.' });
  }
};

// ochirish
exports.deleteDebt = async (req, res) => {
  try {
    const debt = await Debt.findOne({ _id: req.params.id, userId: req.user.id });
    if (!debt) return res.status(404).json({ error: 'Qarz topilmadi.' });

    const wallet = await Wallet.findById(debt.walletId);
    if (!wallet) return res.status(404).json({ error: 'Kassa topilmadi.' });

    if (!debt.amount) {
      return res.status(400).json({ error: 'Qarz summasi yaroqli emas.' });
    }

    if (wallet.balance === undefined || wallet.balance === null) {
      return res.status(400).json({ error: 'Kassa balansi togri emas.' });
    }

    // Получаем все платежи по долгу
    const allPayments = await DebtPayment.find({ debtId: debt._id, userId: req.user.id });
    
    // Вычисляем сумму всех платежей
    let totalPaid = new Decimal(0);
    allPayments.forEach(payment => {
      totalPaid = totalPaid.plus(new Decimal(payment.amount.toString()));
    });

    // Вычисляем оставшуюся сумму долга (остаток)
    const debtAmount = new Decimal(debt.amount.toString());
    const remaining = debtAmount.minus(totalPaid);
    
    // Преобразуем баланс в Decimal
    let balance = new Decimal(wallet.balance.toString());
    
    // Корректируем баланс на основе остатка долга
    if (debt.type === 'given') {
      // Если ты дал в долг, то остаток долга нужно вернуть на баланс
      balance = balance.plus(remaining);
    } else if (debt.type === 'taken') {
      // Если ты взял в долг, то остаток долга нужно вычесть из баланса
      balance = balance.minus(remaining);
    }

    // Сохраняем новый баланс
    wallet.balance = balance.toString();
    await wallet.save();

    // Удаляем платежи и сам долг
    await DebtPayment.deleteMany({ debtId: req.params.id, userId: req.user.id });
    await Debt.deleteOne({ _id: req.params.id, userId: req.user.id });

    res.json({ 
      message: 'Qarz ochirildi.'
    });
  } catch (err) {
    console.error('Delete debt error:', err.message, err.stack);
    res.status(500).json({ error: 'Qarz ochirishda xatolik.' });
  }
};

// Вспомогательная функция для фильтрации по периоду
const getPeriodRange = (period) => {
  const now = new Date();
  const start = new Date();

  switch (period) {
    case 'Bugun':
      start.setHours(0, 0, 0, 0);
      break;
    case 'Bu hafta':
      const day = (now.getDay() + 6) % 7;
      start.setDate(now.getDate() - day);
      start.setHours(0, 0, 0, 0);
      break;
    case 'Bu oy':
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      break;
    case 'Bu yil':
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      break;
    default:
      return {};
  }

  return { $gte: start, $lte: now };
};

// Добавим функцию для получения сводки по долгам
exports.getDebtSummary = async (req, res) => {
  try {
    const userId = req.user.id;
    const period = req.query.period || 'Bu oy';
    const dateFilter = getPeriodRange(period);
    const walletId = req.query.walletId;

    const match = { userId: new mongoose.Types.ObjectId(userId) };

    if (walletId) {
      match.walletId = new mongoose.Types.ObjectId(walletId);
    }

    if (Object.keys(dateFilter).length > 0) {
      match.createdAt = dateFilter;
    }

    // Группировка по статусу и типу
    const summary = await Debt.aggregate([
      { $match: match },
      {
        $group: {
          _id: { status: '$status', type: '$type' },
          total: { $sum: { $toDouble: '$amount' } }
        }
      }
    ]);

    // Инициализация результатов
    let activeGiven = 0, activeTaken = 0;
    let paidGiven = 0, paidTaken = 0;

    // Распределение по статусу и типу
    summary.forEach(item => {
      const { status, type } = item._id;
      const value = item.total;

      if (status === 'active' && type === 'given') activeGiven = value;
      if (status === 'active' && type === 'taken') activeTaken = value;
      if (status === 'paid' && type === 'given') paidGiven = value;
      if (status === 'paid' && type === 'taken') paidTaken = value;
    });

    res.json({
      active: {
        given: activeGiven,
        taken: activeTaken
      },
      paid: {
        given: paidGiven,
        taken: paidTaken
      },
      total: {
        given: activeGiven + paidGiven,
        taken: activeTaken + paidTaken
      }
    });
  } catch (err) {
    console.error('Get debt summary error:', err.message, err.stack);
    res.status(500).json({ error: 'Qarz statistikasini olishda xatolik.' });
  }
};


// Complete implementation of debt stats endpoint
exports.getDebtStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const query = { userId: new mongoose.Types.ObjectId(userId) };

    const stats = await Debt.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$type',
          totalAmount: { $sum: { $toDouble: '$amount' } },
          totalPaid: { $sum: { $toDouble: '$paidAmount' } }
        }
      }
    ]);

    // Преобразуем данные
    let totalGiven = 0, totalGivenPaid = 0;
    let totalTaken = 0, totalTakenPaid = 0;

    stats.forEach(s => {
      if (s._id === 'given') {
        totalGiven = s.totalAmount;
        totalGivenPaid = s.totalPaid;
      } else if (s._id === 'taken') {
        totalTaken = s.totalAmount;
        totalTakenPaid = s.totalPaid;
      }
    });

    res.json({
      totalGiven,
      totalGivenPaid,
      totalGivenRemaining: totalGiven - totalGivenPaid,
      totalTaken,
      totalTakenPaid,
      totalTakenRemaining: totalTaken - totalTakenPaid
    });

  } catch (err) {
    console.error('Get debt stats error:', err.message, err.stack);
    res.status(500).json({ error: 'Qarz statistikasini olishda xatolik.' });
  }
};
