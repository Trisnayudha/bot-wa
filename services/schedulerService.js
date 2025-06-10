// services/schedulerService.js
const cron = require('node-cron');
const mysql = require('mysql2/promise');
const RfWarHandler = require('./handlers/rfWarHandler');
const DailyReminderHandler = require('./handlers/dailyReminderHandler');
const PersonalHandler = require('./handlers/personalHandler');
const DefaultHandler = require('./handlers/defaultHandler');

require('dotenv').config();

const mainPool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const MonitorService = require('./handlers/monitorService'); // <<< Tambahan

const pool = mysql.createPool({
    host: process.env.DB_HOST_IM,
    port: process.env.DB_PORT_IM || 3306,
    user: process.env.DB_USERNAME_IM,
    password: process.env.DB_PASSWORD_IM,
    database: process.env.DB_DATABASE_IM,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

class SchedulerService {
    constructor(client) {
        this.client = client;
        this.scheduled = new Map();  // Map<scheduleId, cronTask>
    }

    // Menjadwalkan attendance summary setiap 5 menit untuk grup tertentu
    async scheduleAttendanceSummary() {
        const groupId = '6281932639000-1567995833@g.us';

        cron.schedule('30,0,30 7-9 * * *', async () => {
            console.log(`📊 Menjalankan attendance summary untuk grup ${groupId} (Setiap 30 menit, 07:30-09:59)`);
            const connection = await pool.getConnection();

            try {
                const [rows] = await connection.query(`
                    SELECT
                        CASE
                            WHEN et.type = 'Platinum' THEN 'Delegate Pass'
                            ELSE et.title
                        END AS ticket_title,
                        COUNT(ud.id) AS count
                    FROM users_delegate ud
                    JOIN events_tickets et ON ud.package_id = et.id
                    WHERE ud.date_day1 = '2025-06-10' AND ud.events_id = 13
                    GROUP BY ticket_title
                `);

                let totalCheckins = 0;  // Variable to store total check-ins

                if (rows.length === 0) {
                    await this.client.sendMessage(groupId, '*Attendance Summary*\nBelum ada peserta yang check-in hari ini.');
                } else {
                    let message = '*Attendance Summary (Day 1)*\n';
                    for (const row of rows) {
                        message += `• ${row.ticket_title}: ${row.count}\n`;
                        totalCheckins += row.count;  // Add to total check-ins
                    }

                    message += `\n*Total Check-ins*: ${totalCheckins}`;

                    await this.client.sendMessage(groupId, message.trim());
                }

            } catch (err) {
                console.error(`❌ Gagal mengambil data attendance summary:`, err);
            } finally {
                connection.release();
            }
        }, {
            timezone: 'Asia/Jakarta'
        });

        cron.schedule('0 * 10-18 * * *', async () => {
            console.log(`📊 Menjalankan attendance summary untuk grup ${groupId} (Setiap jam, 10:00-18:00)`);
            const connection = await pool.getConnection();

            try {
                const [rows] = await connection.query(`
                    SELECT
                        CASE
                            WHEN et.type = 'Platinum' THEN 'Delegate Pass'
                            ELSE et.title
                        END AS ticket_title,
                        COUNT(ud.id) AS count
                    FROM users_delegate ud
                    JOIN events_tickets et ON ud.package_id = et.id
                    WHERE ud.date_day1 = '2025-06-10' AND ud.events_id = 13
                    GROUP BY ticket_title
                `);

                let totalCheckins = 0;  // Variable to store total check-ins

                if (rows.length === 0) {
                    await this.client.sendMessage(groupId, '*Attendance Summary*\nBelum ada peserta yang check-in hari ini.');
                } else {
                    let message = '*Attendance Summary (Day 1)*\n';
                    for (const row of rows) {
                        message += `• ${row.ticket_title}: ${row.count}\n`;
                        totalCheckins += row.count;  // Add to total check-ins
                    }

                    message += `\n*Total Check-ins*: ${totalCheckins}`;

                    await this.client.sendMessage(groupId, message.trim());
                }

            } catch (err) {
                console.error(`❌ Gagal mengambil data attendance summary:`, err);
            } finally {
                connection.release();
            }
        }, {
            timezone: 'Asia/Jakarta'
        });
    }

    // Load active schedules from DB, register new ones and stop removed ones
    async loadAndSchedule() {
        let schedules;
        try {
            [schedules] = await mainPool.query(
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

        // Jadwalkan attendance summary
        await this.scheduleAttendanceSummary();

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