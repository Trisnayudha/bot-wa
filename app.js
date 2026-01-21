// app.js
const { Client, LocalAuth } = require('whatsapp-web.js');

/**
 * 🔥 PATCH KRITIKAL
 * Disable sendSeen (BUG WA WEB markedUnread)
 */
Client.prototype.sendSeen = async function () {
    return true;
};

const qrcode = require('qrcode-terminal');
const messageRoutes = require('./routes/messageRoutes');
const guildController = require('./controllers/guildController');
const SchedulerService = require('./services/schedulerService');

// Membuat client WhatsApp
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
});

client.on('ready', async () => {
    console.log('WhatsApp bot sudah siap!');

    // 🔥 PATCH WA WEB INTERNAL (FINAL FIX)
    const page = client.pupPage;

    await page.evaluate(() => {
        if (window.WWebJS && window.WWebJS.sendSeen) {
            console.log('[PATCH] sendSeen disabled');
            window.WWebJS.sendSeen = async () => true;
        }
    });

    const scheduler = new SchedulerService(client);
    scheduler.start();

    messageRoutes.setClient(client);
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
