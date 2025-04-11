const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const messageRoutes = require('./routes/messageRoutes');

class WhatsAppBot {
    constructor() {
        this.client = new Client({
            authStrategy: new LocalAuth()
        });

        this.client.on('qr', (qr) => {
            qrcode.generate(qr, { small: true });
        });

        this.client.on('ready', () => {
            console.log('WhatsApp bot sudah siap!');
        });

        this.client.on('message', async (message) => {
            await messageRoutes.routeMessage(message);
        });
    }

    start() {
        this.client.initialize();
    }
}

const bot = new WhatsAppBot();
bot.start();
