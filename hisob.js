const express = require('express');
require('dotenv').config();
const cors = require('cors');
const initDB = require('./config/db')
const initBot = require('./bot');

initBot();
initDB()

require('./config/db');

const app = express();

// CORS setup
app.use(cors({
  origin: ['http://localhost:5173', 'https://hisobda.netlify.app'],
  credentials: true
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/tg', require('./routes/auth'));
app.use('/api/action/', require('./routes/transactionRoutes'))
app.use('/api/debt/', require('./routes/debtRoutes'))
app.use('/api/debt-pay/', require('./routes/debtPayment'))

// Test routes
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the API.' });
});

const PORT = process.env.PORT || 7000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));