// services/handlers/monitorService.js
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const cron = require('node-cron');
const dbModel = require('../../models/database');

// Helper: Fetch current JSON data from API via Puppeteer
async function fetchLatestData() {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.goto('https://epic.gamecp.net/web_api/?do=pebeh', {
        waitUntil: 'domcontentloaded',
        timeout: 15000
    });
    const content = await page.evaluate(() => {
        const pre = document.querySelector('pre');
        return pre ? pre.innerText : null;
    });
    await browser.close();
    if (!content) return null;
    try {
        const payload = JSON.parse(content);
        return payload.result || {};
    } catch (e) {
        console.error('JSON parse error in fetchLatestData:', e.message);
        return null;
    }
}

class MonitorService {
    constructor(client, groupChatId) {
        this.client = client;
        this.groupChatId = groupChatId;
        this.pollInterval = '*/1 * * * *'; // polling tiap menit
        this.mapsToMonitor = [
            'resources',
            'sette',
            'neutralc',
            'neutralcs1',
            'neutralcs2',
            'elan'
        ];
        this.bossesToInitialize = {
            neutralcs2: ['Twizer Rex', 'Great Lava', 'Heavy Anabola', 'Blood Vafer Rex'],
            resources: ['Earth Quaker'],
            sette: ['Epic Lord'],
            neutralcs1: ['Rex Cannival', 'Blood King Twizer', 'Brutal Rex', 'Brath', 'RashVafer Luther'],
            elan: [
                'Rock Jaw',
                'Taraven',
                'Blink',
                'Soul Sinder',
                'Calliana Queen',
                'Dagan',
                'Dagnue',
                'Dagon'
            ]
        };
        this.intervalRef = null;
        this.hasInitialized = false;
    }

    async start() {
        if (this.hasInitialized) return;
        this.hasInitialized = true;

        await this._initializeState();
        await this.sendInitialSpawnNotifications();

        // Lakukan satu kali polling awal
        this._pollAndDetect().catch(err => console.error('MonitorService Poll Error:', err.message));

        // Atur interval setiap 30 detik
        this.intervalRef = setInterval(async () => {
            try {
                await this._pollAndDetect();
            } catch (err) {
                console.error('MonitorService Poll Error:', err.message);
            }
        }, 30000);

        console.log(`MonitorService aktif (grup: ${this.groupChatId}) — polling setiap 30 detik`);
    }

    async _initializeState() {
        const existing = await dbModel.getAllPitbossStates();
        if (existing.length) {
            // State sudah terisi → skip inisialisasi
            return;
        }
        const browserInit = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const pageInit = await browserInit.newPage();
        await pageInit.goto('https://epic.gamecp.net/web_api/?do=pebeh', {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });
        const contentInit = await pageInit.evaluate(() => {
            const pre = document.querySelector('pre');
            return pre ? pre.innerText : null;
        });
        await browserInit.close();
        if (!contentInit) return;
        let payloadInit;
        try {
            payloadInit = JSON.parse(contentInit);
        } catch (e) {
            console.error('JSON parse error in initializeState:', e.message);
            return;
        }
        const data = payloadInit.result || {};
        const now = new Date();
        for (const mapCode of this.mapsToMonitor) {
            if (!data[mapCode]?.boss) continue;
            const allowedBosses = this.bossesToInitialize[mapCode] || [];
            for (const boss of data[mapCode].boss) {
                if (!allowedBosses.includes(boss.name)) continue;
                await dbModel.insertPitbossState(
                    mapCode,
                    boss.name,
                    boss.status,
                    now
                );
            }
        }
        console.log('MonitorService: Inisialisasi pitboss_state selesai.');
    }

    async _pollAndDetect() {
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.goto('https://epic.gamecp.net/web_api/?do=pebeh', {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });
        const content = await page.evaluate(() => {
            const pre = document.querySelector('pre');
            return pre ? pre.innerText : null;
        });
        await browser.close();
        if (!content) return;
        let payload;
        try {
            payload = JSON.parse(content);
        } catch (e) {
            console.error('JSON parse error in pollAndDetect:', e.message);
            return;
        }
        const data = payload.result || {};
        const now = new Date();

        for (const mapCode of this.mapsToMonitor) {
            const mapObj = data[mapCode];
            if (!mapObj?.boss) continue;

            for (const boss of mapObj.boss) {
                const bossName = boss.name;
                const newStatus = boss.status;  // "ALIVE" atau "DEAD"

                const prev = await dbModel.getPitbossState(mapCode, bossName);
                if (!prev) {
                    // Jika belum ada record di state → insert lalu lanjut
                    await dbModel.insertPitbossState(mapCode, bossName, newStatus, now);
                    continue;
                }

                const oldStatus = prev.last_status;
                if (oldStatus !== newStatus) {
                    // 1) Insert log
                    await dbModel.insertPitbossLog(
                        mapCode,
                        bossName,
                        oldStatus,
                        newStatus,
                        now
                    );
                    // 2) Update state
                    await dbModel.updatePitbossState(mapCode, bossName, newStatus, now);
                    // 3) Kirim notifikasi WA
                    const text = this._buildNotificationText(
                        mapCode,
                        bossName,
                        oldStatus,
                        newStatus,
                        boss.last_dead_string
                    );
                    await this.client.sendMessage(this.groupChatId, text);
                    console.log(`MonitorService: [${mapCode}/${bossName}] ${oldStatus}→${newStatus}`);
                }
            }
        }
    }

    _buildNotificationText(mapCode, bossName, oldStatus, newStatus, lastDead) {
        const mapNames = {
            resources: 'Craig Mine',
            sette: 'Sette',
            neutralc: 'Cora HQ',
            neutralcs1: 'Haram',
            neutralcs2: 'Numerus'
        };
        const humanMap = mapNames[mapCode] || mapCode;
        const icon = newStatus === 'ALIVE' ? '🟢' : '🔴';
        const timestamp = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

        return (
            `${icon} *Pitboss Update*\n` +
            `• Lokasi   : ${humanMap} \n` +
            `• Boss     : ${bossName}\n` +
            `• Status   : *${oldStatus} → ${newStatus}*\n` +
            `• LastDead : ${lastDead || '-'}\n` +
            `• Waktu    : ${timestamp}`
        );
    }

    // Helper: Get the timestamp of the most recent log (new_status='ALIVE') for a given boss
    async getLatestAliveTimestamp(mapCode, bossName) {
        // Fetch all logs for this boss, ordered by changed_at descending, limited to 1
        const logs = await dbModel.getPitbossLogs(mapCode, bossName);
        if (!logs || logs.length === 0) {
            return null;
        }
        // logs are ordered ascending; take last entry where new_status is 'ALIVE'
        for (let i = logs.length - 1; i >= 0; i--) {
            if (logs[i].new_status === 'ALIVE') {
                return new Date(logs[i].changed_at);
            }
        }
        return null;
    }

    // Sends initial spawn notifications for dynamic bosses (PB RANDOM, BELPE, etc.)
    async sendInitialSpawnNotifications() {
        const now = new Date();

        // Helper to format Date to ID locale string
        const formatDate = (date) => date.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

        // 1. PB MASSAL: hours [2,6,10,14,18,22] at minute 31 second 47
        const massalHours = [2, 6, 10, 14, 18, 22];
        let nextMassal;
        for (const h of massalHours) {
            const candidate = new Date(now);
            candidate.setHours(h, 31, 47, 0);
            if (candidate > now) {
                nextMassal = candidate;
                break;
            }
        }
        if (!nextMassal) {
            // If none left today, take first tomorrow
            nextMassal = new Date(now);
            nextMassal.setDate(now.getDate() + 1);
            nextMassal.setHours(massalHours[0], 31, 47, 0);
        }

        // 2. PB RANDOM: every hour at minute 56 second 20
        let nextRandom = new Date(now);
        nextRandom.setMinutes(56, 20, 0);
        if (nextRandom <= now) {
            nextRandom.setHours(nextRandom.getHours() + 1);
        }
        // Schedule validation for PB RANDOM
        const delayRandom = nextRandom.getTime() - now.getTime();
        setTimeout(() => {
            this.validateRandomSpawn().catch(err => console.error('Error validateRandomSpawn:', err.message));
        }, delayRandom);

        // 3. BELPE: odd hour at minute 15 second 4
        const isOdd = (num) => num % 2 === 1;
        let nextBelpe = new Date(now);
        const currentHour = now.getHours();
        if (isOdd(currentHour) && (
            now.getMinutes() < 15 || (now.getMinutes() === 15 && now.getSeconds() < 4)
        )) {
            nextBelpe.setHours(currentHour, 15, 4, 0);
        } else {
            let nextOdd = isOdd(currentHour) ? currentHour + 2 : currentHour + 1;
            nextBelpe = new Date(now);
            nextBelpe.setHours(nextOdd, 15, 4, 0);
        }
        // Schedule validation for BELPE
        const delayBelpe = nextBelpe.getTime() - now.getTime();
        setTimeout(() => {
            this.validateBelpeSpawn().catch(err => console.error('Error validateBelpeSpawn:', err.message));
        }, delayBelpe);

        // 4. URSA: odd hour at minute 36 second 15 (every 2 hours)
        let nextUrsa = new Date(now);
        if (isOdd(currentHour) && (
            now.getMinutes() < 36 || (now.getMinutes() === 36 && now.getSeconds() < 15)
        )) {
            nextUrsa.setHours(currentHour, 36, 15, 0);
        } else {
            let nextOddUrsa = isOdd(currentHour) ? currentHour + 2 : currentHour + 1;
            nextUrsa = new Date(now);
            nextUrsa.setHours(nextOddUrsa, 36, 15, 0);
        }

        // 5. PB ELAN: fixed at 20:15
        let nextElan = new Date(now);
        nextElan.setHours(20, 15, 0, 0);
        if (nextElan <= now) {
            nextElan.setDate(nextElan.getDate() + 1);
        }

        // 6. 3D: fixed at 20:30
        let next3d = new Date(now);
        next3d.setHours(20, 30, 0, 0);
        if (next3d <= now) {
            next3d.setDate(next3d.getDate() + 1);
        }

        // Construct message
        const message =
            `⏰ *Prediksi Next Spawn Pit Boss*

• PB MASSAL (Splinter, Ramot, WB; Haran, Cani, Brutal):
  → ${formatDate(nextMassal)}

• PB RANDOM (FVN, RVL, BKT, VARAS, LAVA, ANABOLA, TR, BVR):
  → ${formatDate(nextRandom)}

• BELPE:
  → ${formatDate(nextBelpe)}

• URSA:
  → ${formatDate(nextUrsa)}

• PB ELAN:
  → ${formatDate(nextElan)}

• PB 3D:
  → ${formatDate(next3d)}
`;

        await this.client.sendMessage(this.groupChatId, message);
    }

    // Validate PB RANDOM spawn status at predicted time
    async validateRandomSpawn() {
        const data = await fetchLatestData();
        if (!data) return;
        // List of random bosses to check
        const randomMap = 'neutralc';
        const randomBosses = ['Frenzy Ratmoth', 'Argol Drone', 'WarBeast Kin', 'Splinter Rex'];
        // You can adjust this list to match actual random boss names in JSON
        let message = `🔍 *Verifikasi PB RANDOM*\n`;
        for (const bossName of randomBosses) {
            const bossEntry = (data[randomMap]?.boss || []).find(b => b.name === bossName);
            const status = bossEntry ? bossEntry.status : 'UNKNOWN';
            message += `• ${bossName}: ${status}\n`;
        }
        await this.client.sendMessage(this.groupChatId, message);
    }

    // Validate BELPE spawn status at predicted time
    async validateBelpeSpawn() {
        const data = await fetchLatestData();
        if (!data) return;
        const mapCode = 'cauldron01';
        const bossName = 'Belphegor';
        const bossEntry = (data[mapCode]?.boss || []).find(b => b.name === bossName);
        const status = bossEntry ? bossEntry.status : 'UNKNOWN';
        const message = `🔍 *Verifikasi BELPE*\n• ${bossName}: ${status}`;
        await this.client.sendMessage(this.groupChatId, message);
    }
}

module.exports = MonitorService;