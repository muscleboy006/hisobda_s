const mongoose = require('mongoose');
const Decimal = require('decimal.js');
const Wallet = require('./models/Wallet'); // Adjust path to your Wallet model
const Transaction = require('./models/Transaction'); // Adjust path to your Transaction model

// MongoDB connection
const MONGO_URI = 'mongodb://localhost:27017/hisobchi'; // Replace with your MongoDB URI
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Configuration
const TEST_USER_ID = '68258866bd1466dde5d052e4'; // Replace with a valid user ID from your database
const TEST_WALLET_ID = '6813624243e36f988e75bbf5'; // Replace with a valid wallet ID from your database
const TOTAL_TRANSACTIONS = 36000;
const BATCH_SIZE = 1000; // Process transactions in batches of 1000
const CATEGORIES = ['shopping', 'salary', 'gift', 'award', 'debt', 'other'];
const TRANSACTION_TYPES = ['income', 'expense'];

// Utility to generate random dates (within the last year)
function getRandomDate() {
  const start = new Date();
  start.setFullYear(start.getFullYear() - 1);
  const end = new Date();
  const randomTime = start.getTime() + Math.random() * (end.getTime() - start.getTime());
  return new Date(randomTime);
}

// Utility to generate random amount (between 1000 and 1000000 UZS)
function getRandomAmount() {
  return Math.floor(Math.random() * (1000000 - 1000 + 1)) + 1000;
}

// Utility to pick random element from array
function getRandomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Generate a single transaction
async function generateTransaction(wallet) {
  const type = getRandomElement(TRANSACTION_TYPES);
  const amount = new Decimal(getRandomAmount());
  const currentBalance = new Decimal(wallet.balance.toString());
  
  // Check if expense would make balance negative
  if (type === 'expense' && currentBalance.minus(amount).isNegative()) {
    return null; // Skip this transaction
  }

  return {
    userId: TEST_USER_ID,
    walletId: TEST_WALLET_ID,
    type,
    amount: mongoose.Types.Decimal128.fromString(amount.toString()),
    category: getRandomElement(CATEGORIES),
    note: `Test transaction ${type} - ${getRandomElement(CATEGORIES)}`,
    date: getRandomDate()
  };
}

// Main function to add transactions
async function addTestTransactions() {
  try {
    // Find wallet
    const wallet = await Wallet.findOne({ _id: TEST_WALLET_ID, userId: TEST_USER_ID });
    if (!wallet) {
      throw new Error('Wallet not found');
    }

    let transactionsCreated = 0;
    const transactionsToInsert = [];

    // Generate transactions
    while (transactionsCreated < TOTAL_TRANSACTIONS) {
      const transaction = await generateTransaction(wallet);
      if (transaction) {
        transactionsToInsert.push(transaction);
        transactionsCreated++;
        
        // Update wallet balance
        const transactionAmount = new Decimal(transaction.amount.toString());
        const currentBalance = new Decimal(wallet.balance.toString());
        wallet.balance = mongoose.Types.Decimal128.fromString(
          (transaction.type === 'income' 
            ? currentBalance.plus(transactionAmount) 
            : currentBalance.minus(transactionAmount)
          ).toString()
        );

        // Process batch when reaching BATCH_SIZE or end
        if (transactionsToInsert.length >= BATCH_SIZE || transactionsCreated === TOTAL_TRANSACTIONS) {
          console.log(`Inserting batch of ${transactionsToInsert.length} transactions...`);
          await Transaction.insertMany(transactionsToInsert);
          await wallet.save();
          console.log(`Batch inserted. Total transactions: ${transactionsCreated}`);
          transactionsToInsert.length = 0; // Clear batch
        }
      }
    }

    console.log('All transactions created successfully');
  } catch (error) {
    console.error('Error generating transactions:', error);
  } finally {
    mongoose.disconnect();
  }
}

// Run the script
addTestTransactions();