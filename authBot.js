require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const User = require('./models/User');

const SITE_URL = process.env.SITE_URL

class TelegramBotService {
  constructor() {
    this.bot = new TelegramBot(process.env.BOT_AUTH_TOKEN, { polling: true });

    this.bot.onText(/\/start/, async (msg) => this.handleStart(msg));
    this.bot.onText(/^\/hammaga(?: (.+))?/, async (msg, match) => this.handleBroadcast(msg, match));
    this.bot.on('message', async (msg) => this.handleMessage(msg));
  }

  async handleStart(msg) {
    const chatId = msg.chat.id.toString();
    const telegramId = msg.from.id.toString();
    const referralParam = msg.text.split(' ')[1];
    let user = await User.findOne({ telegramId });
    await this.sendMainMenu(chatId);

    if (!user) {
      let referrerUser = null;
      if (referralParam) {
        referrerUser = await User.findOne({ telegramId: referralParam });
      }

      user = new User({
        telegramId,
        first_name: msg.from.first_name,
        last_name: msg.from.last_name || '',
        auth_date: Date.now()
      });
      await user.save();

       // 👉 Сообщаем админу один раз
      await this.bot.sendMessage(
        '7890054155',
        `🆕 Yangi foydalanuvchi ro'yxatdan o'tdi:\n\nIsmi: ${user.first_name}\nFamiliyasi: ${user.last_name}\nUsername: ${msg.from.username}\nTelegram ID: ${user.telegramId}`
      );

      if (referrerUser) {
        referrerUser.referrals.push(user._id);
        await referrerUser.save();

        // 👉 отправляем сообщение пригласившему
        await this.bot.sendMessage(
        referrerUser.telegramId,
        `🎉 Siz taklif qilgan foydalanuvchi (${user.first_name}) ro'yxatdan o'tdi!`
      );
      }
    }
  }

  async handleBroadcast(msg, match) {
    const adminId = process.env.ADMIN_TELEGRAM_ID;
    const senderId = msg.from.id.toString();
  
    if (senderId !== adminId) {
      return this.bot.sendMessage(msg.chat.id, "⛔ Sizda bu buyruqni bajarishga ruxsat yo'q.");
    }
  
    const message = match[1];
    if (!message) {
      return this.bot.sendMessage(msg.chat.id, "ℹ️ Xabar matnini yuboring: `/hammaga Salom hammaga!`", { parse_mode: 'Markdown' });
    }
  
    const users = await User.find({ telegramId: { $exists: true } });
  
    let sent = 0, failed = 0;
    for (const user of users) {
      try {
        await this.bot.sendMessage(user.telegramId, message);
        sent++;
      } catch (err) {
        failed++;
      }
    }
  
    await this.bot.sendMessage(msg.chat.id, `✅ Yuborildi: ${sent}\n❌ Yuborib bo'lmadi: ${failed}`);
  }
  
  async handleMessage(msg) {
    const chatId = msg.chat.id.toString();
    const text = msg.text.trim();

    if (text === "Asosiy") {
      return this.bot.sendMessage(chatId, "Asosiy ko‘rish uchun tugmani bosing:", {
        reply_markup: {
          inline_keyboard: [[
            { text: "Asosiy", web_app: { url: `${SITE_URL}/#/dashboard` } }
          ]]
        }
      });
    }
    
    if (text === "Qarzlar") {
      return this.bot.sendMessage(chatId, "Qarzlar ochish uchun tugmani bosing:", {
        reply_markup: {
          inline_keyboard: [[
            { text: "Qarzlar", web_app: { url: `${SITE_URL}/#/debts` } }
          ]]
        }
      });
    }
    
    if (text === "Hisobot") {
      return this.bot.sendMessage(chatId, "Hisobotlarni ko‘rish uchun tugmani bosing:", {
        reply_markup: {
          inline_keyboard: [[
            { text: "Hisobot", web_app: { url: `${SITE_URL}/#/reports` } }
          ]]
        }
      });
    }
    
    if (text === "Sozlama") {
      return this.bot.sendMessage(chatId, "Sozlamalarni ko‘rish uchun tugmani bosing:", {
        reply_markup: {
          inline_keyboard: [[
            { text: "Sozlama", web_app: { url: `${SITE_URL}/#/setting` } }
          ]]
        }
      });
    }

    if (text === "📣 Do'stlarni taklif qilish") {
        const user = await User.findOne({ telegramId: msg.from.id.toString() });
      
        const referralLink = `https://t.me/hisobda_app_bot?start=${user.telegramId}`;
        const invitedCount = user.referrals.length;
        const targetCount = 5;
        const remaining = targetCount - invitedCount;
      
        let bonusMessage = '';
        if (invitedCount >= targetCount) {
          bonusMessage = `🎁 Siz 5 ta do'stni taklif qildingiz va 1 oylik bepul Premium oldingiz!`;
        } else {
          bonusMessage = `🔔 Siz ${invitedCount} ta do'stni taklif qildingiz.\n${remaining} ta do'st taklif qilsangiz — 1 oylik bepul Premium olasiz! \n\nPastdagi habarni yuboring👇`;
        }
      
        // Сообщение для самого пользователя
        await this.bot.sendMessage(chatId, 
          `${bonusMessage}`
        );
      
        // Красивое короткое рекламное сообщение для пересылки
        const shareMessage = 
      `💍 *Nikoh Uz* — Jiddiy tanishuvlar platformasi\n\n`+
      
      `🔥 Xavfsiz • Oson • Ishonchli\n\n`+
      
      `👫 O'z nasibangizni toping!\n`+
      `👉 [Ro'yxatdan o'tish](${referralLink})\n\n`+
      
      `✨ *Baxtli oila qurish uchun birinchi qadam!*`
      
        await this.bot.sendMessage(chatId, shareMessage, { parse_mode: 'Markdown' });
        return;
      }
  }

  async sendMainMenu(chatId) {
    await this.bot.sendMessage(chatId, "👇 Bo'limlardan birini tanlang:", {
      reply_markup: {
        keyboard: [
          [{ text: "Asosiy" }, { text: "Qarzlar" }],
          [{ text: "Hisobot" }, { text: "Sozlama" }],
          [{ text: "📣 Do'stlarni taklif qilish" }]
        ],
        resize_keyboard: true
      }
    });
  }  
}

const telegramBotService = new TelegramBotService();
module.exports = { telegramBotService };