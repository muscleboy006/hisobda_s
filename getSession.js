const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const input = require("input"); // npm i input

const apiId = 26167391;
const apiHash = "c61ddec770820a6314873a2ee8d933b2";
const stringSession = new StringSession(""); // пустая строка

(async () => {
    const client = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 5,
    });

    await client.start({
        phoneNumber: async () => await input.text("Telefon raqam: "),
        password: async () => await input.text("Ikkinchi parol (2FA): "),
        phoneCode: async () => await input.text("Kod: "),
        onError: (err) => console.log(err),
    });

    console.log(">>> Session String:");
    console.log(client.session.save());
})();
