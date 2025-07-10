require("dotenv").config();
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { Api } = require("telegram");
const { NewMessage } = require("telegram/events");

const apiId = parseInt(process.env.API_ID);
const apiHash = process.env.API_HASH;
const stringSession = new StringSession(process.env.STRING_SESSION); // 🔐 Сессия из .env
const autoReplyMessage = 
`Hurmatli foydalanuvchi,\n\n`+

`So‘rovingiz qabul qilindi. Iltimos, quyidagi karta raqamiga to‘lovni amalga oshiring:\n\n`+

`💳 9860 1666 0206 2175\n`+
`👤 Abdurahmon Hamroqulov\n\n`+

`To‘lovdan so‘ng sizga javob qaytariladi. Tashakkur!`;

(async () => {
    console.log("📲 Telegram klient ishga tushirilmoqda...");

    const client = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 5,
    });

    await client.start({
        onError: err => console.error("❌ Start error:", err),
    });

    console.log("✅ Klient ulandi!");

    const self = await client.getMe();
    console.log(`👤 Logged in as ${self.username || self.firstName}`);

    client.addEventHandler(async (event) => {
        try {
            const msg = event.message;

            if (!msg || msg.out || !msg.isPrivate) return;

            const sender = await msg.getSender().catch(() => null);
            if (!sender || sender.bot) return;

            // Check your status
            const selfEntity = await client.invoke(
                new Api.users.GetUsers({ id: [self.id] })
            );

            const status = selfEntity[0]?.status;
            if (
                status instanceof Api.UserStatusOnline ||
                status instanceof Api.UserStatusRecently
            ) {
                console.log("🚫 Siz hozir onlayn/tanishilgan holatdasiz. Javob yuborilmaydi.");
                return;
            }

            // console.log(`📨 Yangi xabar: ${msg.message}`);
            await client.sendMessage(sender, { message: autoReplyMessage });

            // Optional: force offline status
            await client.invoke(new Api.account.UpdateStatus({ offline: true })).catch(err => {
                console.error("⚠️ Offline statusni o'zgartirishda xatolik:", err);
            });

        } catch (err) {
            console.error("❌ Xabarni qayta ishlashda xatolik:", err);
        }
    }, new NewMessage({}));

})();
