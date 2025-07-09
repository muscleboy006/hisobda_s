require('dotenv').config();
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

// Тут укажи MongoDB _id пользователя:
const MONGO_USER_ID = '6860cdb41897a9ac572883de';

const token = jwt.sign({ id: MONGO_USER_ID }, JWT_SECRET, { expiresIn: '30d' });

console.log('Ваш тестовый токен:');
console.log(token);