require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const User = require('./models/User');

const pendingDateChanges = {};
let bot;

async function initBot() {
  if (bot) return bot;

  bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

  await mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  console.log('✅ MongoDB connected');

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (chatId != 717474239) return;

    if (msg.forward_from) {
      const originalUser = msg.forward_from;
      return bot.sendMessage(chatId, `📩 Переслано от пользователя:\nTelegram ID: <code>${originalUser.id}</code>`, {
        parse_mode: 'HTML',
      });
    }

    if (pendingDateChanges[chatId]) {
      const telegramId = pendingDateChanges[chatId];
      delete pendingDateChanges[chatId];

      const isValidDate = /^\d{4}-\d{2}-\d{2}$/.test(text);
      if (!isValidDate) {
        return bot.sendMessage(chatId, '❌ Неверный формат. Используй YYYY-MM-DD.');
      }

      try {
        const user = await User.findOne({ telegramId });
        if (!user || !user.premiumEndsAt) {
          return bot.sendMessage(chatId, '❌ Пользователь не найден или поле premiumEndsAt пустое.');
        }

        const [year, month, day] = text.split('-').map(Number);
        const newDate = new Date(user.premiumEndsAt);
        newDate.setFullYear(year, month - 1, day);

        user.premiumEndsAt = newDate;
        await user.save();

        bot.sendMessage(chatId, `✅ Дата premiumEndsAt обновлена:\n<i>${user.premiumEndsAt}</i>`, {
          parse_mode: 'HTML',
        });
      } catch (err) {
        console.error(err);
        bot.sendMessage(chatId, '❌ Ошибка при обновлении даты.');
      }

      return;
    }

    if (text.startsWith('/start')) return;

    try {
      const user = await User.findOne({ telegramId: text });

      if (user) {
        const message =
          `✅ Найден пользователь Telegram ID: ${user.telegramId}\n` +
          `<b>Ism:</b> ${user.first_name}\n` +
          `<b>Familiya:</b> ${user.last_name}\n` +
          `<b>username:</b> @${user.username}\n` +
          `<b>userCreatedAt:</b> <i>${user.createdAt}</i>\n` +
          `<b>userpremiumEndsAt:</b> <i>${user.premiumEndsAt}</i>\n`;

        bot.sendMessage(chatId, message, {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[
              { text: '🗓 Изменить premiumEndsAt', callback_data: `change_trial_${user.telegramId}` },
              { text: '🔄 Вперед на месяц', callback_data: `plus_month_${user.telegramId}` },
            ]]
          }
        });
      } else {
        bot.sendMessage(chatId, `❌ Пользователь с telegramId ${text} не найден.`);
      }
    } catch (err) {
      console.error('Ошибка поиска:', err);
      bot.sendMessage(chatId, 'Произошла ошибка при поиске.');
    }
  });

  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    if (chatId != 717474239) return;

    if (data.startsWith('change_trial_')) {
      const telegramId = data.replace('change_trial_', '');
      pendingDateChanges[chatId] = telegramId;

      bot.sendMessage(chatId, '📅 Введите новую дату в формате YYYY-MM-DD (время останется прежним):');
    }

    if (data.startsWith('plus_month_')) {
      const telegramId = data.replace('plus_month_', '');
      try {
        const user = await User.findOne({ telegramId });
        if (!user || !user.premiumEndsAt) {
          return bot.sendMessage(chatId, '❌ Пользователь не найден или поле premiumEndsAt пустое.');
        }
    
        const now = new Date();
        let baseDate = new Date(user.premiumEndsAt);
    
        // Если премиум уже закончился, начинаем от текущей даты
        if (baseDate < now) {
          baseDate = now;
        }
    
        baseDate.setMonth(baseDate.getMonth() + 1);
        user.premiumEndsAt = baseDate;
        await user.save();
    
        bot.sendMessage(chatId, `✅ premiumEndsAt продлён на месяц:\n<i>${user.premiumEndsAt}</i>`, {
          parse_mode: "HTML"
        });
      } catch (err) {
        console.error(err);
        bot.sendMessage(chatId, '❌ Ошибка при продлении премиума.');
      }
    }
    

    bot.answerCallbackQuery(query.id);
  });

  return bot;
}

module.exports = initBot;