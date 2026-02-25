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

let schedulerStarted = false;

// Membuat client WhatsApp
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
});

client.once('ready', async () => {
    console.log('WhatsApp bot sudah siap!');

    try {
        const page = client.pupPage;

        await page.evaluate(() => {
            if (window.WWebJS && window.WWebJS.sendSeen) {
                window.WWebJS.sendSeen = async () => true;
            }
        });

    } catch (err) {
        console.log('[PATCH ERROR]', err.message);
    }

    // 🔥 START SCHEDULER ONLY ONCE
    if (!schedulerStarted) {
        const scheduler = new SchedulerService(client);
        scheduler.start();
        schedulerStarted = true;
    }

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

client.on('disconnected', (reason) => {
    console.log('Client disconnected:', reason);
});

client.initialize();
