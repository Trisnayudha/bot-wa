// services/schedulerService.js
const cron = require('node-cron');
const mysql = require('mysql2/promise');
const RfWarHandler = require('./handlers/rfWarHandler');
const DailyReminderHandler = require('./handlers/dailyReminderHandler');
const PersonalHandler = require('./handlers/personalHandler');
const DefaultHandler = require('./handlers/defaultHandler');
require('dotenv').config();

const MonitorService = require('./handlers/monitorService'); // <<< Tambahan

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
        this.scheduled = new Map();  // Map<scheduleId, cronTask>
    }

    // Load active schedules from DB, register new ones and stop removed ones
    async loadAndSchedule() {
        let schedules;
        try {
            [schedules] = await pool.query(
                'SELECT * FROM schedules WHERE is_active = 1'
            );
        } catch (err) {
            console.error('❌ Gagal ambil data jadwal dari DB:', err);
            return;
        }

        const activeIds = new Set();

        // Register new schedules
        for (const s of schedules) {
            activeIds.add(s.id);

            if (!this.scheduled.has(s.id)) {
                const task = cron.schedule(
                    s.cron_expression,
                    async () => {
                        const start = new Date();
                        console.log(`🚀 [${s.id}] Mulai task (${s.type}) pada ${start.toLocaleString()}`);

                        try {
                            let handler;
                            if (s.use_ai) {
                                switch (s.type) {
                                    case 'rf-war':
                                        handler = new RfWarHandler(this.client, s);
                                        break;
                                    case 'daily-reminder':
                                        handler = new DailyReminderHandler(this.client, s);
                                        break;
                                    case 'personal':
                                        handler = new PersonalHandler(this.client, s);
                                        break;
                                    default:
                                        handler = new DefaultHandler(this.client, s);
                                }
                            } else {
                                handler = new DefaultHandler(this.client, s);
                            }

                            await handler.handle();
                        } catch (err) {
                            console.error(`❌ Error eksekusi jadwal ID ${s.id}:`, err);
                        }

                        const end = new Date();
                        console.log(`✅ [${s.id}] Selesai task pada ${end.toLocaleString()} (Durasi: ${(end - start) / 1000}s)`);
                    },
                    {
                        timezone: s.timezone || 'Asia/Jakarta'
                    }
                );

                this.scheduled.set(s.id, task);
                console.log(`➕ [${s.id}] Jadwal baru didaftarkan (${s.cron_expression} — ${s.type})`);
            }
        }

        // Stop and remove schedules that are no longer active
        for (const [id, task] of this.scheduled) {
            if (!activeIds.has(id)) {
                task.stop();
                this.scheduled.delete(id);
                console.log(`➖ [${id}] Jadwal dihentikan karena tidak aktif lagi`);
            }
        }
    }

    // Start the scheduler: initial load, then polling every minute
    async start() {
        await this.loadAndSchedule();

        // Poll every minute to pick up DB changes
        cron.schedule('* * * * *', () => {
            this.loadAndSchedule().catch(err => {
                console.error('❌ Error saat polling jadwal:', err);
            });
        });

        console.log('🚀 Scheduler aktif dengan polling setiap menit');

        // -------------------------------------------------------
        // Setelah scheduler aktif, inisialisasi MonitorService
        // -------------------------------------------------------
        const groupIdsEnv = process.env.WA_GROUP_IDS || '';
        const groupIds = groupIdsEnv.split(',').map(s => s.trim()).filter(s => s.length > 0);

        if (groupIds.length > 0) {
            for (const gid of groupIds) {
                // Buat instan MonitorService untuk setiap grup
                const monitor = new MonitorService(this.client, gid);
                monitor.start().catch(err => {
                    console.error(`❌ MonitorService gagal dimulai untuk grup ${gid}:`, err);
                });
            }
        } else {
            console.warn('⚠️ WA_GROUP_IDS kosong. MonitorService tidak dijalankan.');
        }
    }
}

module.exports = SchedulerService;