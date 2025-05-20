const Transaction = require('../models/Transaction');
const Debt = require('../models/Debt');
const mongoose = require('mongoose');
const Wallet = require('../models/Wallet');
 
const getStatistics = async (req, res) => {
  try {
    const userId = req.user.id;
    const period = req.query.period || 'Bu oy';

    const dateFilter = getPeriodRange(period);
    const match = { userId: new mongoose.Types.ObjectId(userId) };
    if (Object.keys(dateFilter).length > 0) {
      match.date = dateFilter;
    }

    // 1. Топ доходы и расходы
    const topTransactions = await Transaction.aggregate([
      { $match: match },
      {
        $facet: {
          topIncomes: [
            { $match: { type: 'income' } },
            { $sort: { amount: -1 } },
            { $limit: 5 }
          ],
          topExpenses: [
            { $match: { type: 'expense' } },
            { $sort: { amount: -1 } },
            { $limit: 5 }
          ],
          totals: [
            {
              $group: {
                _id: '$type',
                total: { $sum: { $toDouble: '$amount' } }
              }
            }
          ]
        }
      }
    ]);

    const { topIncomes, topExpenses, totals } = topTransactions[0];

    let totalIncome = 0;
    let totalExpense = 0;
    totals.forEach(t => {
      if (t._id === 'income') totalIncome = t.total;
      if (t._id === 'expense') totalExpense = t.total;
    });

    // 2. Долги (только активные)
    const activeDebtsMatch = {
      userId: new mongoose.Types.ObjectId(userId),
      status: { $ne: 'paid' }
    };

    const topDebtsData = await Debt.aggregate([
      { $match: activeDebtsMatch },
      {
        $facet: {
          topDebts: [
            { $match: { type: 'taken' } },
            { $sort: { amount: -1 } },
            { $limit: 5 }
          ],
          topDebtors: [
            { $match: { type: 'given' } },
            { $sort: { amount: -1 } },
            { $limit: 5 }
          ],
          debtStats: [
            {
              $group: {
                _id: '$type',
                totalAmount: { $sum: { $toDouble: '$amount' } },
                totalPaid: { $sum: { $toDouble: '$paidAmount' } }
              }
            }
          ]
        }
      }
    ]);

    const { topDebts, topDebtors, debtStats } = topDebtsData[0];

    let totalGivenDebts = 0;
    let totalTakenDebts = 0;

    debtStats.forEach(d => {
      const remaining = d.totalAmount - d.totalPaid;
      if (d._id === 'given') totalGivenDebts = remaining;
      if (d._id === 'taken') totalTakenDebts = remaining;
    });

    const wallet = await Wallet.findOne({ userId })
    const balance = wallet.balance

    res.json({
      topIncomes,
      topExpenses,
      topDebts,    // Твои долги
      topDebtors,  // Кто должен тебе
      summary: {
        income: totalIncome,
        expense: totalExpense,
        balance,
        givenDebts: totalGivenDebts,
        takenDebts: totalTakenDebts,
      }
    });
  } catch (error) {
    console.error('Statistics error:', error);
    res.status(500).json({ error: 'Statistikani olishda xatolik.' });
  }
};

// Та же getPeriodRange, можешь оставить как есть
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
    case 'Umumiy':
      start.setFullYear(1970, 0, 1);
      start.setHours(0, 0, 0, 0);
      break;
    default:
      return {};
  }

  return { $gte: start, $lte: now };
};

module.exports = getStatistics