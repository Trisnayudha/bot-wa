const cron = require('node-cron');
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

class SchedulerService {
    constructor(client) {
        this.client = client;
    }

    async start() {
        try {
            const [schedules] = await pool.query('SELECT * FROM schedules WHERE is_active = 1');

            schedules.forEach(schedule => {
                cron.schedule(schedule.cron_expression, async () => {
                    const chatId = schedule.chat_id;
                    const message = schedule.message;

                    try {
                        const chat = await this.client.getChatById(chatId);

                        if (chatId.endsWith('@g.us')) {
                            const mentions = chat.participants.map(p => p.id._serialized);
                            await chat.sendMessage(message, { mentions });
                            console.log(`Pesan (group + hidetag) terkirim ke ${chatId}`);
                        } else {
                            await this.client.sendMessage(chatId, message);
                            console.log(`Pesan (personal) terkirim ke ${chatId}`);
                        }
                    } catch (err) {
                        console.error(`Gagal kirim pesan ke ${chatId}:`, err);
                    }
                }, {
                    timezone: schedule.timezone || 'Asia/Jakarta'
                });
            });

            console.log('Scheduler dari DB aktif 🚀');
        } catch (error) {
            console.error('Gagal ambil jadwal dari DB:', error);
        }
    }
}

module.exports = SchedulerService;
