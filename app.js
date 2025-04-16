// app.js
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const messageRoutes = require('./routes/messageRoutes');
const guildController = require('./controllers/guildController');

// Membuat client WhatsApp
const client = new Client({
    authStrategy: new LocalAuth(),  // Menggunakan LocalAuth untuk menyimpan session
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']  // Menambahkan opsi untuk bypass sandboxing
    }
});
client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('WhatsApp bot sudah siap!');
});

client.on('message', async (message) => {
    await messageRoutes.routeMessage(message);
});

client.on('group_join', async (notification) => {
    await guildController.handleGroupJoin(notification, client);
});

client.on('group_leave', async (notification) => {
    await guildController.handleGroupLeave(notification, client);
});

client.initialize();
