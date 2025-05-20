const mongoose = require('mongoose');
const Decimal = require('decimal.js');
const Wallet = require('./models/Wallet');
const Debt = require('./models/Debt');

// MongoDB connection
const MONGO_URI = 'mongodb://localhost:27017/hisobchi';
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Config
const TEST_USER_ID = '68258866bd1466dde5d052e4'; // Replace with actual user ID
const TEST_WALLET_ID = '6813624243e36f988e75bbf5'; // Replace with actual wallet ID
const TOTAL_DEBTS = 300;
const BATCH_SIZE = 30;
const DEBT_TYPES = ['given', 'taken'];
const NAMES = ['Ahmad', 'Ismoil', 'Said', 'Maryam', 'Lola', 'Ibrohim', 'Bilol', 'Nodira', 'Aziz', 'Karim'];

// Helpers
function getRandomDate() {
  const start = new Date();
  start.setFullYear(start.getFullYear() - 1);
  const end = new Date();
  const randomTime = start.getTime() + Math.random() * (end.getTime() - start.getTime());
  return new Date(randomTime);
}

function getRandomAmount() {
  return Math.floor(Math.random() * (500000 - 10000 + 1)) + 10000;
}

function getRandomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function generateDebt(wallet) {
  const type = getRandomElement(DEBT_TYPES);
  const amount = new Decimal(getRandomAmount());
  const balance = new Decimal(wallet.balance.toString());

  if (type === 'given' && balance.lessThan(amount)) {
    return null; // Skip if not enough funds for 'given'
  }

  // Adjust wallet balance accordingly
  wallet.balance = mongoose.Types.Decimal128.fromString(
    (type === 'taken' ? balance.plus(amount) : balance.minus(amount)).toString()
  );

  return {
    userId: TEST_USER_ID,
    walletId: TEST_WALLET_ID,
    type,
    amount: mongoose.Types.Decimal128.fromString(amount.toString()),
    person: getRandomElement(NAMES),
    note: `${type === 'taken' ? 'Olingan' : 'Berilgan'} test qarz`,
    createdAt: getRandomDate(),
    updatedAt: new Date()
  };
}

async function addFakeDebts() {
  try {
    const wallet = await Wallet.findOne({ _id: TEST_WALLET_ID, userId: TEST_USER_ID });
    if (!wallet) throw new Error('Wallet not found');

    let created = 0;
    const debtsToInsert = [];

    while (created < TOTAL_DEBTS) {
      const debt = await generateDebt(wallet);
      if (debt) {
        debtsToInsert.push(debt);
        created++;

        if (debtsToInsert.length >= BATCH_SIZE || created === TOTAL_DEBTS) {
          console.log(`Inserting batch of ${debtsToInsert.length} debts...`);
          await Debt.insertMany(debtsToInsert);
          await wallet.save();
          debtsToInsert.length = 0;
          console.log(`Inserted ${created} debts so far.`);
        }
      }
    }

    console.log('✅ All debts created successfully');
  } catch (err) {
    console.error('❌ Error generating debts:', err);
  } finally {
    mongoose.disconnect();
  }
}

addFakeDebts();
