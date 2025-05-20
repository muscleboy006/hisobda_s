const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Wallet = require('../models/Wallet')
const crypto = require('crypto');

const BOT_TOKEN = process.env.BOT_TOKEN; // Токен вашего Telegram бота
const JWT_SECRET = process.env.JWT_SECRET;

// Проверка данных аутентификации Telegram
function checkTelegramAuthorization(data) {
  const { hash, ...userData } = data;
  
  // Сортируем поля в алфавитном порядке
  const dataCheckArr = Object.keys(userData)
    .sort()
    .map(key => `${key}=${userData[key]}`);
  
  const dataCheckString = dataCheckArr.join('\n');
  
  // Создаем секретный ключ на основе токена бота
  const secretKey = crypto
    .createHash('sha256')
    .update(BOT_TOKEN)
    .digest();
  
  // Создаем хэш для проверки
  const hmac = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');
  
  return hmac === hash;
}

// Генерация JWT токена
function generateToken(userId) {
  return jwt.sign({ id: userId }, JWT_SECRET, {
    expiresIn: '30d' // Токен действителен 30 дней
  });
}

// Эндпоинт для проверки аутентификации
const authTelegram = async (req, res) => {
  const telegramData = req.body;

  if (!telegramData) {
    return res.status(400).json({ success: false, error: 'Отсутствуют данные аутентификации' });
  }

  // Проверяем возраст данных (не более 1 часа)
  const authDate = telegramData.auth_date;
  const currentTime = Math.floor(Date.now() / 1000);

  if (currentTime - authDate > 3600) {
    return res.status(401).json({ success: false, error: 'Данные аутентификации устарели' });
  }

  // Проверяем подлинность данных
  if (!checkTelegramAuthorization(telegramData)) {
    return res.status(401).json({ success: false, error: 'Неверные данные аутентификации' });
  }

  try {
    let user = await User.findOne({ telegramId: telegramData.id });
    let walletId;

    if (user) {
      // Обновляем данные существующего пользователя
      user.first_name = telegramData.first_name;
      user.last_name = telegramData.last_name || '';
      user.username = telegramData.username || '';
      user.photo_url = telegramData.photo_url || '';
      user.auth_date = telegramData.auth_date;
      user.lastLogin = Date.now();
      await user.save();

      // Находим кошелёк
      const wallet = await Wallet.findOne({ userId: user._id });
      if (wallet) {
        walletId = wallet._id;
      } else {
        // Если по какой-то причине кошелька нет — создаём
        const newWallet = await Wallet.create({
          userId: user._id,
          name: 'Naqd',
          balance: 0
        });
        walletId = newWallet._id;
      }
    } else {
      // Создаём нового пользователя
      user = new User({
        telegramId: telegramData.id,
        first_name: telegramData.first_name,
        last_name: telegramData.last_name || '',
        username: telegramData.username || '',
        photo_url: telegramData.photo_url || '',
        auth_date: telegramData.auth_date
      });
      await user.save();

      // Создаём кошелёк по умолчанию
      const walletDoc = await Wallet.create({
        userId: user._id,
        name: 'Naqd',
        balance: 0
      });
      walletId = walletDoc._id;
    }

    // Генерируем токен и возвращаем
    const token = generateToken(user._id);
    const userData = {
      id: user.telegramId,
      _id: user._id,
      first_name: user.first_name,
      last_name: user.last_name,
      username: user.username,
      photo_url: user.photo_url,
      auth_date: user.auth_date
    };

    res.json({
      success: true,
      user: userData,
      token,
      walletId
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};


// Эндпоинт для получения данных пользователя по токену
const userProfile = async (req, res) => {
  try {
    const user = {
      id: req.user.telegramId,
      _id: req.user._id,
      first_name: req.user.first_name,
      last_name: req.user.last_name,
      username: req.user.username,
      photo_url: req.user.photo_url,
      auth_date: req.user.auth_date,
      createdAt: req.user.createdAt,
      lastLogin: req.user.lastLogin
    };
    
    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

// GET /wallets - Получить кошельки текущего пользователя
const wallet = async (req, res) => {
  try {
    const wallet = await Wallet.find({ userId: req.user.id });
    res.json({ success: true, wallet });
  } catch (error) {
    console.error('Ошибка при получении кошельков:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

// Add this to your auth routes file (e.g., routes/auth.js)

// Verification endpoint to check if token is valid
const verify = (req, res) => {
  // If authMiddleware passed, the user is authenticated
  res.json({ 
    success: true, 
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email
      // Add other non-sensitive user data you might need
    } 
  });
};

// Проверка доступа: премиум или пробный период
const accessStatus = async (req, res) => {
  try {
    const user = req.user;
    const now = new Date();

    const isPremium = user.isPremium;
    const premiumEndsAt = user.premiumEndsAt ? new Date(user.premiumEndsAt) : null;
    const isPremiumActive = isPremium && premiumEndsAt && now <= premiumEndsAt;

    // Если премиум истёк — обновим статус в БД
    if (isPremium && !isPremiumActive) {
      user.isPremium = false;
      await user.save(); // сохраняем обновление
    }

    res.json({
      success: true,
      isPremium: user.isPremium, // актуальное значение после возможного сброса
      premiumEndsAt: user.premiumEndsAt,
    });
  } catch (error) {
    console.error('Ошибка при проверке доступа:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

module.exports = {
    authTelegram,
    userProfile,
    wallet,
    verify,
    accessStatus
}