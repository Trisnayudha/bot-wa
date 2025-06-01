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
            'neutralc',
            'neutralcs1',
            'neutralcs2',
            'elan'
        ];
        this.bossesToInitialize = {
            neutralcs2: ['Twizer Rex', 'Great Lava', 'Heavy Anabola', 'Blood Vafer Rex'],
            resources: ['Earth Quaker'],
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

    // Helper: Get next PB RANDOM spawn (hourly at minute 56 second 20)
    _getNextRandomSpawn(baseTime = new Date()) {
        const next = new Date(baseTime);
        next.setMinutes(56, 20, 0);
        if (next <= baseTime) {
            next.setHours(next.getHours() + 1);
        }
        return next;
    }

    // Helper: Get next BELPE spawn (odd hour at minute 15 second 4)
    _getNextBelpeSpawn(baseTime = new Date()) {
        const now = new Date(baseTime);
        const hour = now.getHours();
        const minute = now.getMinutes();
        const second = now.getSeconds();
        const isOdd = (num) => num % 2 === 1;
        let next;
        if (isOdd(hour) && (minute < 15 || (minute === 15 && second < 4))) {
            next = new Date(now);
            next.setHours(hour, 15, 4, 0);
        } else {
            const nextOdd = isOdd(hour) ? hour + 2 : hour + 1;
            next = new Date(now);
            next.setHours(nextOdd, 15, 4, 0);
        }
        return next;
    }

    // Helper: Format Date to ID locale string
    _formatDate(date) {
        return date.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
    }

    // Helper: Schedule a 30-minute prior reminder for a boss
    _scheduleReminder(mapCode, bossName, nextSpawn) {
        const reminderTime = new Date(nextSpawn.getTime() - 30 * 60000);
        const now = new Date();
        if (reminderTime <= now) {
            // If already past, do not schedule
            return;
        }
        const delay = reminderTime.getTime() - now.getTime();
        setTimeout(() => {
            const humanMap = {
                resources: 'Craig Mine',
                sette: 'Sette',
                neutralc: 'Cora HQ',
                neutralcs1: 'Haram',
                neutralcs2: 'Numerus',
                cauldron01: 'Volcanic Cauldron',
                elan: 'Elan'
            }[mapCode] || mapCode;
            const text = `⏰ *Reminder*: Pit Boss *${bossName}* di *${humanMap}* akan spawn pada *${this._formatDate(nextSpawn)}* (30 menit lagi)`;
            this.client.sendMessage(this.groupChatId, text);
        }, delay);
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

        // Collect all updates in this cycle
        const updates = [];

        for (const mapCode of this.mapsToMonitor) {
            const mapObj = data[mapCode];
            if (!mapObj?.boss) continue;

            for (const boss of mapObj.boss) {
                const bossName = boss.name;
                const newStatus = boss.status;  // "ALIVE" atau "DEAD"

                const prev = await dbModel.getPitbossState(mapCode, bossName);
                if (!prev) {
                    await dbModel.insertPitbossState(mapCode, bossName, newStatus, now);
                    continue;
                }

                const oldStatus = prev.last_status;
                if (oldStatus !== newStatus) {
                    // Record update for messaging
                    const update = {
                        mapCode,
                        bossName,
                        oldStatus,
                        newStatus,
                        lastDead: boss.last_dead_string,
                        nextSpawn: null
                    };

                    // If going from ALIVE -> DEAD, compute next spawn
                    if (oldStatus === 'ALIVE' && newStatus === 'DEAD') {
                        if (mapCode === 'cauldron01' && bossName.includes('Belphegor')) {
                            update.nextSpawn = this._getNextBelpeSpawn(now);
                        } else if (mapCode.startsWith('neutral')) {
                            update.nextSpawn = this._getNextRandomSpawn(now);
                        }
                        // Add other mapCode cases here if needed
                    }

                    updates.push(update);

                    // 1) Insert log
                    await dbModel.insertPitbossLog(mapCode, bossName, oldStatus, newStatus, now);
                    // 2) Update state
                    await dbModel.updatePitbossState(mapCode, bossName, newStatus, now);
                }
            }
        }

        // If there are any updates, send a single combined message
        if (updates.length > 0) {
            const mapNames = {
                resources: 'Craig Mine',
                neutralc: 'Cora HQ',
                neutralcs1: 'Haram',
                neutralcs2: 'Numerus',
                neutralas1: 'Armory 213',
                neutralas2: 'Armory 117',
                neutrala: 'Accretia HQ',
                neutralb: 'Bellato HQ',
                neutralbs1: 'Solus',
                neutralbs2: 'Anacaade',
                cauldron01: 'Volcanic Cauldron',
                dungeon03: 'Dimension',
                elan: 'Elan',
                exile_land: 'Outcast Land',
                medicallab: 'Cartella Lab (1)',
                medicallab2: 'Cartella Lab (2)',
                mountain_beast: 'Mountain Beast',
                platform01: 'Ether'
            };

            // Separate updates into spawned vs died
            const spawnList = [];
            const diedList = [];
            for (const u of updates) {
                if (u.oldStatus === 'DEAD' && u.newStatus === 'ALIVE') {
                    spawnList.push(u);
                } else if (u.oldStatus === 'ALIVE' && u.newStatus === 'DEAD') {
                    diedList.push(u);
                }
            }

            let messageLines = [];

            // Part 1: Spawned
            if (spawnList.length > 0) {
                messageLines.push('🔥 *Pit Boss Spawned:*');
                for (const u of spawnList) {
                    const humanMap = mapNames[u.mapCode] || u.mapCode;
                    messageLines.push(`• ${humanMap} ‒ ${u.bossName}`);
                }
                messageLines.push(''); // separator
            }

            // Part 2: Died (with Next Spawn)
            if (diedList.length > 0) {
                messageLines.push('💀 *Pit Boss Died (Next Spawn):*');
                for (const u of diedList) {
                    const humanMap = mapNames[u.mapCode] || u.mapCode;
                    if (u.nextSpawn) {
                        const nextSpawnStr = u.nextSpawn.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
                        messageLines.push(`• ${humanMap} ‒ ${u.bossName}  → ${nextSpawnStr}`);
                    } else {
                        messageLines.push(`• ${humanMap} ‒ ${u.bossName}`);
                    }
                }
            }

            const finalMessage = messageLines.join('\n');
            await this.client.sendMessage(this.groupChatId, finalMessage);
        }
    }

    _buildNotificationText(mapCode, bossName, oldStatus, newStatus, lastDead) {
        const mapNames = {
            resources: 'Craig Mine',
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

• PB ELAN:
  → ${formatDate(nextElan)}

• PB 3D:
  → ${formatDate(next3d)}
`;

        await this.client.sendMessage(this.groupChatId, message);

        // Schedule 30-minute reminders for each dynamic boss currently DEAD
        // Fetch all pitboss states from DB
        const allStates = await dbModel.getAllPitbossStates();
        const now2 = new Date();
        for (const state of allStates) {
            const { map_code: mapCode, boss_name: bossName, last_status: status, last_checked: lastChecked } = state;
            if (status !== 'DEAD') continue;

            let nextSpawn = null;
            const lastDeadTime = new Date(lastChecked);

            // Dynamic category: PB RANDOM (neutral maps)
            if (mapCode.startsWith('neutral')) {
                nextSpawn = this._getNextRandomSpawn(lastDeadTime);
            }
            // Dynamic category: BELPE (Belphegor in cauldron01)
            else if (mapCode === 'cauldron01' && bossName.includes('Belphegor')) {
                nextSpawn = this._getNextBelpeSpawn(lastDeadTime);
            }
            // Add other dynamic categories as needed

            if (nextSpawn) {
                // Schedule the 30-minute reminder
                this._scheduleReminder(mapCode, bossName, nextSpawn);
            }
        }
        return;
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