// services/schedulerService.js
const cron = require('node-cron');
// const mysql = require('mysql2/promise'); // <<< KOMENTARI ATAU HAPUS INI jika tidak ada pool lain yang pakai
const axios = require('axios'); // <<< TAMBAH INI

const RfWarHandler = require('./handlers/rfWarHandler');
const DailyReminderHandler = require('./handlers/dailyReminderHandler');
const PersonalHandler = require('./handlers/personalHandler');
const DefaultHandler = require('./handlers/defaultHandler');

require('dotenv').config();

// Pool koneksi utama (DB_HOST) - HANYA BIARKAN JIKA MASIH DIGUNAKAN DI TEMPAT LAIN!
// Jika semua koneksi DB dialihkan ke API, ini juga bisa dihapus.
const mainPool = require('mysql2/promise').createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const MonitorService = require('./handlers/monitorService');

// Pool koneksi IM (DB_HOST_IM) - HANYA BIARKAN JIKA MASIH DIGUNAKAN DI TEMPAT LAIN!
const pool = require('mysql2/promise').createPool({
    host: process.env.DB_HOST_IM,
    port: process.env.DB_PORT_IM || 3306,
    user: process.env.DB_USERNAME_IM,
    password: process.env.DB_PASSWORD_IM,
    database: process.env.DB_DATABASE_IM,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// =========================================================================
// >>>>>>> dmcPool DIHAPUS DARI SINI KARENA KITA MENGGUNAKAN API <<<<<<<
// =========================================================================

class SchedulerService {
    constructor(client) {
        this.client = client;
        this.scheduled = new Map();  // Map<scheduleId, cronTask>
    }

    // Menjadwalkan attendance summary setiap 5 menit untuk grup tertentu
    // KODE INI DIKEMBALIKAN SEPERTI SEMULA (DIKOMENTARI)
    // async scheduleAttendanceSummary() {
    //     const groupId = '628193234928717023@g.us'; // Contoh Group ID

    //     cron.schedule('30,0,30 7-9 * * *', async () => {
    //         console.log(`📊 Menjalankan attendance summary untuk grup ${groupId} (Setiap 30 menit, 07:30-09:59)`);
    //         const connection = await pool.getConnection();

    //         try {
    //             const [rows] = await connection.query(`
    //                 SELECT
    //                     CASE
    //                         WHEN et.type = 'Platinum' THEN 'Delegate Pass'
    //                         ELSE et.title
    //                     END AS ticket_title,
    //                     COUNT(ud.id) AS count
    //                 FROM users_delegate ud
    //                 JOIN events_tickets et ON ud.package_id = et.id
    //                 WHERE ud.date_day3 BETWEEN '2025-06-12 00:00:00' AND '2025-06-12 23:59:59' AND ud.events_id = 13
    //                 GROUP BY ticket_title
    //             `);

    //             let totalCheckins = 0;

    //             if (rows.length === 0) {
    //                 await this.client.sendMessage(groupId, '*Attendance Summary*\nBelum ada peserta yang check-in hari ini.');
    //             } else {
    //                 let message = '*Attendance Summary (Day 3)*\n';
    //                 for (const row of rows) {
    //                     message += `• ${row.ticket_title}: ${row.count}\n`;
    //                     totalCheckins += row.count;
    //                 }

    //                 message += `\n*Total Check-ins*: ${totalCheckins}`;

    //                 await this.client.sendMessage(groupId, message.trim());
    //             }

    //         } catch (err) {
    //             console.error(`❌ Gagal mengambil data attendance summary:`, err);
    //         } finally {
    //             connection.release();
    //         }
    //     }, {
    //         timezone: 'Asia/Jakarta'
    //     });

    //     cron.schedule('30,0,30 10-17 * * *', async () => {
    //         console.log(`📊 Menjalankan attendance summary untuk grup ${groupId} (Setiap jam, 10:00-18:00)`);
    //         const connection = await pool.getConnection();

    //         try {
    //             const [rows] = await connection.query(`
    //                 SELECT
    //                     CASE
    //                         WHEN et.type = 'Platinum' THEN 'Delegate Pass'
    //                         ELSE et.title
    //                     END AS ticket_title,
    //                     COUNT(ud.id) AS count
    //                 FROM users_delegate ud
    //                 JOIN events_tickets et ON ud.package_id = et.id
    //                 WHERE ud.date_day3 BETWEEN '2025-06-12 00:00:00' AND '2025-06-12 23:59:59' AND ud.events_id = 13
    //                 GROUP BY ticket_title
    //             `);

    //             let totalCheckins = 0;

    //             if (rows.length === 0) {
    //                 await this.client.sendMessage(groupId, '*Attendance Summary*\nBelum ada peserta yang check-in hari ini.');
    //             } else {
    //                 let message = '*Attendance Summary (Day 3)*\n';
    //                 for (const row of rows) {
    //                     message += `• ${row.ticket_title}: ${row.count}\n`;
    //                     totalCheckins += row.count;
    //                 }

    //                 message += `\n*Total Check-ins*: ${totalCheckins}`;

    //                 await this.client.sendMessage(groupId, message.trim());
    //             }

    //         } catch (err) {
    //             console.error(`❌ Gagal mengambil data attendance summary:`, err);
    //         } finally {
    //             connection.release();
    //         }
    //     }, {
    //         timezone: 'Asia/Jakarta'
    //     });
    // }

    // Load active schedules from DB, register new ones and stop removed ones
    // KODE INI DIKEMBALIKAN SEPERTI SEMULA (DIKOMENTARI)
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

    // =========================================================================
    // >>>>>>> FUNGSI scheduleDmcCheckinSummary - MENGGUNAKAN axios.post <<<<<<<
    // =========================================================================

    async scheduleDmcCheckinSummary() {
        const groupId = process.env.DMC_SUMMARY_GROUP_ID;
        const eventId = process.env.DMC_EVENT_ID;
        const apiUrl = process.env.DMC_SUMMARY_API_URL;

        if (!groupId || !eventId || !apiUrl) {
            console.warn('⚠️ DMC_SUMMARY_GROUP_ID, DMC_EVENT_ID, atau DMC_SUMMARY_API_URL tidak ditemukan di .env. DMC Check-in Summary tidak akan berjalan.');
            return;
        }

        // =====================================================================
        // >>>>>>> PERUBAHAN EKSPRESI CRON DI SINI <<<<<<<
        // Jadwalkan setiap 15 menit, dari jam 15:00 - 18:59, pada tanggal 24 Juli 2025
        // '*/15'  -> setiap 15 menit (pada menit 0, 15, 30, 45)
        // '15-18' -> pada jam 15, 16, 17, 18
        // '24'    -> pada hari ke-24 dalam bulan
        // '7'     -> pada bulan Juli
        // '*'     -> pada setiap hari dalam seminggu
        cron.schedule('*/15 15-18 24 7 *', async () => {
            // =====================================================================

            console.log(`📊 Menjalankan DMC Check-in Summary untuk grup ${groupId} (setiap 15 menit) - Via API POST`);
            const currentTime = new Date();
            const currentHour = currentTime.getHours();
            const currentMinute = currentTime.getMinutes();
            const currentDate = currentTime.getDate(); // Ambil tanggal hari ini
            const currentMonth = currentTime.getMonth() + 1; // Ambil bulan hari ini (0-11) + 1

            // --- VALIDASI TAMBAHAN UNTUK TANGGAL DAN WAKTU PRESISI ---
            // Pastikan hanya berjalan pada 24 Juli
            if (currentDate !== 24 || currentMonth !== 7) {
                console.log(`Skipping DMC Check-in Summary. Not 24th July.`);
                return;
            }

            // Validasi untuk memastikan hanya berjalan antara 15:30 dan 18:30
            if (currentHour === 15 && currentMinute < 30) {
                console.log(`Skipping DMC Check-in Summary before 15:30.`);
                return;
            }
            if (currentHour === 18 && currentMinute > 30) {
                console.log(`Skipping DMC Check-in Summary after 18:30.`);
                return;
            }
            // --- AKHIR VALIDASI TAMBAHAN ---

            try {
                const response = await axios.post(
                    apiUrl,
                    { event_id: eventId }
                );

                const rows = response.data;

                let totalCheckins = 0;
                let message = '*DMC Check-in Summary*\n';

                if (!rows || rows.length === 0) {
                    message += 'Belum ada peserta yang check-in untuk event DMC ini.\n';
                } else {
                    for (const row of rows) {
                        message += `• ${row.package_category}: ${row.count}\n`;
                        totalCheckins += +row.count;
                    }
                }

                message += `\n*Total Checked-in*: ${totalCheckins}`;
                message += `\n*Update Terakhir*: ${new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' })}`;

                await this.client.sendMessage(groupId, message.trim());

            } catch (err) {
                console.error(`❌ Gagal mengambil data DMC Check-in Summary dari API (POST):`, err.message);
                if (err.response) {
                    console.error('API Response Error Data:', err.response.data);
                    console.error('API Response Status:', err.response.status);
                    console.error('API Response Headers:', err.response.headers);
                } else if (err.request) {
                    console.error('API Request Error: No response received');
                } else {
                    console.error('API General Error:', err.message);
                }
            }
        }, {
            timezone: 'Asia/Jakarta'
        });
    }

    // =========================================================================


    // Start the scheduler: initial load, then polling every minute
    async start() {
        // KODE INI DIKEMBALIKAN SEPERTI SEMULA (DIKOMENTARI)
        await this.loadAndSchedule();

        // Jadwalkan attendance summary (jika perlu, uncomment)
        // await this.scheduleAttendanceSummary();

        // >>>>>>> Panggil fungsi baru di sini - TETAP ADA <<<<<<<
        // await this.scheduleDmcCheckinSummary();

        // Poll every minute to pick up DB changes
        // KODE INI DIKEMBALIKAN SEPERULA (DIKOMENTARI)
        cron.schedule('* * * * *', () => {
            this.loadAndSchedule().catch(err => {
                console.error('❌ Error saat polling jadwal:', err);
            });
        });

        console.log('🚀 Scheduler aktif dengan polling setiap menit');

        // -------------------------------------------------------
        // Setelah scheduler aktif, inisialisasi MonitorService
        // KODE INI DIKEMBALIKAN SEPERULA (DIKOMENTARI)
        // -------------------------------------------------------
        // const groupIdsEnv = process.env.WA_GROUP_IDS || '';
        // const groupIds = groupIdsEnv.split(',').map(s => s.trim()).filter(s => s.length > 0);

        // if (groupIds.length > 0) {
        //     for (const gid of groupIds) {
        //         // Buat instan MonitorService untuk setiap grup
        //         // Pastikan MonitorService mendapatkan akses ke dmcPool jika ia memerlukannya
        //         const monitor = new MonitorService(this.client, gid /* , dmcPool */);
        //         monitor.start().catch(err => {
        //             console.error(`❌ MonitorService gagal dimulai untuk grup ${gid}:`, err);
        //         });
    }
}

module.exports = SchedulerService;

// Opsional: Ekspor dmcPool jika Anda ingin menggunakannya di luar SchedulerService, misalnya di test.
// module.exports.dmcPool = dmcPool;