const cron = require('node-cron');
const mysql = require('mysql2/promise');
const RfWarHandler = require('./handlers/rfWarHandler');
const DailyReminderHandler = require('./handlers/dailyReminderHandler');
const DefaultHandler = require('./handlers/defaultHandler'); // Tambah ini
const PersonalHandler = require('./handlers/personalHandler'); // Tambah import
require('dotenv').config();

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
                    const startTime = new Date();
                    console.log(`🚀 [${schedule.id}] Mulai task (${schedule.type}) pada ${startTime.toLocaleString()}`);

                    try {
                        let handler;

                        switch (true) {
                            case schedule.use_ai && schedule.type === 'rf-war':
                                handler = new RfWarHandler(this.client, schedule);
                                break;
                            case schedule.use_ai && schedule.type === 'daily-reminder':
                                handler = new DailyReminderHandler(this.client, schedule);
                                break;
                            case schedule.use_ai && schedule.type === 'personal':
                                handler = new PersonalHandler(this.client, schedule);
                                break;
                            default:
                                // Fallback semua yang use_ai = 0 ke DefaultHandler
                                handler = new DefaultHandler(this.client, schedule);
                                break;
                        }


                        await handler.handle(); // Eksekusi handler
                    } catch (err) {
                        console.error(`❌ Error eksekusi jadwal ID ${schedule.id}:`, err);
                    }

                    const endTime = new Date();
                    console.log(`✅ [${schedule.id}] Selesai task pada ${endTime.toLocaleString()} (Durasi: ${(endTime - startTime) / 1000}s)`);
                }, {
                    timezone: schedule.timezone || 'Asia/Jakarta'
                });
            });

            console.log('🚀 Scheduler aktif dan menjadwalkan semua task dari DB!');
        } catch (error) {
            console.error('❌ Gagal ambil data jadwal dari DB:', error);
        }
    }
}

module.exports = SchedulerService;
