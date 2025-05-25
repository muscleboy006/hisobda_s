// const mongoose = require('mongoose');
// const Decimal = require('decimal.js');
// const Wallet = require('./models/Wallet'); // Adjust path to your Wallet model
// const Transaction = require('./models/Transaction'); // Adjust path to your Transaction model

// // MongoDB connection
// const MONGO_URI = 'mongodb://localhost:27017/hisobchi'; // Replace with your MongoDB URI
// mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
//   .then(() => console.log('Connected to MongoDB'))
//   .catch(err => console.error('MongoDB connection error:', err));

// // Configuration
// const TEST_USER_ID = '68292440ea4fb07348216e3d'; // Replace with a valid user ID from your database
// const TEST_WALLET_ID = '68292440ea4fb07348216e3f'; // Replace with a valid wallet ID from your database
// const TOTAL_TRANSACTIONS = 36000;
// const BATCH_SIZE = 1000; // Process transactions in batches of 1000
// const CATEGORIES = ['shopping', 'salary', 'gift', 'award', 'debt', 'other'];
// const TRANSACTION_TYPES = ['income', 'expense'];

// // Utility to generate random dates (within the last year)
// function getRandomDate() {
//   const start = new Date();
//   start.setFullYear(start.getFullYear() - 1);
//   const end = new Date();
//   const randomTime = start.getTime() + Math.random() * (end.getTime() - start.getTime());
//   return new Date(randomTime);
// }

// // Utility to generate random amount (between 1000 and 1000000 UZS)
// function getRandomAmount() {
//   return Math.floor(Math.random() * (1000000 - 1000 + 1)) + 1000;
// }

// // Utility to pick random element from array
// function getRandomElement(arr) {
//   return arr[Math.floor(Math.random() * arr.length)];
// }

// // Generate a single transaction
// async function generateTransaction(wallet) {
//   const type = getRandomElement(TRANSACTION_TYPES);
//   const amount = new Decimal(getRandomAmount());
//   const currentBalance = new Decimal(wallet.balance.toString());
  
//   // Check if expense would make balance negative
//   if (type === 'expense' && currentBalance.minus(amount).isNegative()) {
//     return null; // Skip this transaction
//   }

//   return {
//     userId: TEST_USER_ID,
//     walletId: TEST_WALLET_ID,
//     type,
//     amount: mongoose.Types.Decimal128.fromString(amount.toString()),
//     category: getRandomElement(CATEGORIES),
//     note: `Test transaction ${type} - ${getRandomElement(CATEGORIES)}`,
//     date: getRandomDate()
//   };
// }

// // Main function to add transactions
// async function addTestTransactions() {
//   try {
//     // Find wallet
//     const wallet = await Wallet.findOne({ _id: TEST_WALLET_ID, userId: TEST_USER_ID });
//     if (!wallet) {
//       throw new Error('Wallet not found');
//     }

//     let transactionsCreated = 0;
//     const transactionsToInsert = [];

//     // Generate transactions
//     while (transactionsCreated < TOTAL_TRANSACTIONS) {
//       const transaction = await generateTransaction(wallet);
//       if (transaction) {
//         transactionsToInsert.push(transaction);
//         transactionsCreated++;
        
//         // Update wallet balance
//         const transactionAmount = new Decimal(transaction.amount.toString());
//         const currentBalance = new Decimal(wallet.balance.toString());
//         wallet.balance = mongoose.Types.Decimal128.fromString(
//           (transaction.type === 'income' 
//             ? currentBalance.plus(transactionAmount) 
//             : currentBalance.minus(transactionAmount)
//           ).toString()
//         );

//         // Process batch when reaching BATCH_SIZE or end
//         if (transactionsToInsert.length >= BATCH_SIZE || transactionsCreated === TOTAL_TRANSACTIONS) {
//           console.log(`Inserting batch of ${transactionsToInsert.length} transactions...`);
//           await Transaction.insertMany(transactionsToInsert);
//           await wallet.save();
//           console.log(`Batch inserted. Total transactions: ${transactionsCreated}`);
//           transactionsToInsert.length = 0; // Clear batch
//         }
//       }
//     }

//     console.log('All transactions created successfully');
//   } catch (error) {
//     console.error('Error generating transactions:', error);
//   } finally {
//     mongoose.disconnect();
//   }
// }

// // Run the script
// addTestTransactions();
const mongoose = require('mongoose');
const Decimal = require('decimal.js');
const Wallet = require('./models/Wallet');
const Transaction = require('./models/Transaction');

// MongoDB connection
const MONGO_URI = 'mongodb://localhost:27017/hisobchi';
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Configuration
const TARGET_USER_ID = '68292440ea4fb07348216e3d';
const TARGET_WALLET_ID = '68292440ea4fb07348216e3f';
const TOTAL_RANDOM_TRANSACTIONS = 298000;
const TOTAL_TARGET_TRANSACTIONS = 2000;
const BATCH_SIZE = 1000;
const CATEGORIES = ['shopping', 'salary', 'gift', 'award', 'debt', 'other'];
const TRANSACTION_TYPES = ['income', 'expense'];

// Utils
function getRandomDate() {
  const start = new Date();
  start.setFullYear(start.getFullYear() - 1);
  const end = new Date();
  const randomTime = start.getTime() + Math.random() * (end.getTime() - start.getTime());
  return new Date(randomTime);
}

function getRandomAmount() {
  return Math.floor(Math.random() * (1000000 - 1000 + 1)) + 1000;
}

function getRandomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateRandomObjectId() {
  return new mongoose.Types.ObjectId().toString();
}

function buildTransaction(userId, walletId, type, amount) {
  return {
    userId,
    walletId,
    type,
    amount: mongoose.Types.Decimal128.fromString(amount.toString()),
    category: getRandomElement(CATEGORIES),
    note: `Test ${type} - ${getRandomElement(CATEGORIES)}`,
    date: getRandomDate()
  };
}

// Step 1: Generate 298K transactions for random users
async function generateRandomTransactions() {
  console.log('🚀 Generating random user transactions...');

  let totalInserted = 0;
  const batch = [];

  while (totalInserted < TOTAL_RANDOM_TRANSACTIONS) {
    const randomUserId = generateRandomObjectId();
    const randomWalletId = generateRandomObjectId();
    const type = getRandomElement(TRANSACTION_TYPES);
    const amount = new Decimal(getRandomAmount());

    const transaction = buildTransaction(randomUserId, randomWalletId, type, amount);
    batch.push(transaction);
    totalInserted++;

    if (batch.length >= BATCH_SIZE || totalInserted === TOTAL_RANDOM_TRANSACTIONS) {
      await Transaction.insertMany(batch);
      console.log(`✅ Inserted ${totalInserted} random transactions`);
      batch.length = 0;
    }
  }

  console.log('✅ Finished inserting random transactions');
}

// Step 2: Generate 2K transactions for the target user
async function generateTargetUserTransactions() {
  console.log('🎯 Generating target user transactions...');

  const wallet = await Wallet.findOne({ _id: TARGET_WALLET_ID, userId: TARGET_USER_ID });
  if (!wallet) throw new Error('Target wallet not found');

  let inserted = 0;
  const batch = [];

  while (inserted < TOTAL_TARGET_TRANSACTIONS) {
    const type = getRandomElement(TRANSACTION_TYPES);
    const amount = new Decimal(getRandomAmount());
    const currentBalance = new Decimal(wallet.balance.toString());

    if (type === 'expense' && currentBalance.minus(amount).isNegative()) {
      continue; // skip negative balance
    }

    const transaction = buildTransaction(TARGET_USER_ID, TARGET_WALLET_ID, type, amount);
    batch.push(transaction);
    inserted++;

    // Update balance
    wallet.balance = mongoose.Types.Decimal128.fromString(
      (type === 'income' ? currentBalance.plus(amount) : currentBalance.minus(amount)).toString()
    );

    if (batch.length >= BATCH_SIZE || inserted === TOTAL_TARGET_TRANSACTIONS) {
      await Transaction.insertMany(batch);
      await wallet.save();
      console.log(`✅ Inserted ${inserted} target user transactions`);
      batch.length = 0;
    }
  }

  console.log('✅ Finished inserting target user transactions');
}

// Main
async function run() {
  try {
    await generateRandomTransactions();
    await generateTargetUserTransactions();
    console.log('🎉 All transactions generated successfully');
  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    mongoose.disconnect();
  }
}

run();