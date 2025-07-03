const { MessageMedia } = require('whatsapp-web.js');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');
const mysql = require('mysql2/promise');
require('dotenv').config();

// Use the stealth plugin to bypass Cloudflare's protections
puppeteer.use(StealthPlugin());

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});


async function handleGroupJoin(notification, client) {
    try {
        const chat = await notification.getChat();

        // Pastikan ini adalah grup yang ditentukan
        if (chat.id._serialized === '120363042863310424@g.us') {
            // Dapatkan ID peserta dari notifikasi (dari properti "participant")
            const userId = notification.id.participant;
            console.log(`User ID: ${userId}`);

            // Ekstrak nomor (tanpa domain @c.us)
            const number = userId.split('@')[0];
            const joinType = notification.type; // 'add' atau 'invite'
            console.log(`Join Type: ${joinType}`);

            // Pesan sambutan umum (teks standar untuk guild)
            const welcomeMessage = `🎉🎉🎉🎉 WELCOME 🎉🎉🎉🎉

🤺 Kita guild keras, jangan cupu
⚖ Kita guild support race sepi, up mental
👥 Kita guild rame, kena rolling jangan baper
🕵 Kita guild orang dalem, equip sabar dikit
🥷 Kita guild tabrak backline, jangan culun
💪🏻 Kita server pvp, jangan takut mati PUKI!
🔃 Kita guild reload, SA SHS GAS LANGSUNG
🍄 Kita guild asik, di discord harus ketawa
🥱 Belum discord? ya join lah sendirian aja
🤑 Kita guild entrepreneur, nyari loker pm as-`;

            // Untuk joinType "add", kirim foto profil dengan caption gabungan
            if (joinType === 'add') {
                try {
                    const contact = await client.getContactById(userId);
                    const nameOrNumber = contact.pushname || contact.name || number;
                    const profilePicUrl = await contact.getProfilePicUrl();

                    console.log(`Contact Name: ${nameOrNumber}`);
                    console.log(`Profile Pic URL: ${profilePicUrl}`);

                    // Gabungkan pesan welcome guild dan ucapan personal ke dalam satu caption
                    const caption = `${welcomeMessage}\n\nSelamat datang, ${nameOrNumber}!`;

                    if (profilePicUrl) {
                        // Dynamic import untuk node-fetch (karena node-fetch sudah ESM)
                        const { default: fetch } = await import('node-fetch');
                        const res = await fetch(profilePicUrl);
                        const arrayBuffer = await res.arrayBuffer();
                        const buffer = Buffer.from(arrayBuffer);

                        const media = new MessageMedia(
                            res.headers.get('content-type'),
                            buffer.toString('base64')
                        );
                        await chat.sendMessage(media, { caption });
                    } else {
                        // Jika foto profil tidak ada, kirim pesan teks saja
                        await chat.sendMessage(`${welcomeMessage}\n\nSelamat datang, ${nameOrNumber}!`);
                    }
                } catch (err) {
                    console.error('Gagal mendapatkan informasi kontak:', err.message);
                    // Fallback jika terjadi error
                    await chat.sendMessage(`${welcomeMessage}\n\nSelamat datang, ${number}!`);
                }
            } else if (joinType === 'invite') {
                // Untuk joinType "invite", hanya kirim pesan teks sambutan
                await chat.sendMessage(`${welcomeMessage}\n\nSelamat datang, ${number}!`);
            }
        }
    } catch (error) {
        console.error('Gagal memproses anggota baru:', error.message);
    }
}

async function handleGroupLeave(notification, client) {
    try {
        const chat = await notification.getChat();

        // Pastikan notifikasi berasal dari grup yang diinginkan
        if (chat.id._serialized === '120363042863310424@g.us') {
            // Ambil ID peserta yang keluar
            const userId = notification.id.participant;
            const number = userId.split('@')[0]; // Ekstrak nomor (tanpa @c.us)

            try {
                // Dapatkan data kontak untuk peserta yang keluar
                const contact = await client.getContactById(userId);
                const nameOrNumber = contact.pushname || contact.name || number;
                const profilePicUrl = await contact.getProfilePicUrl();

                // Buat pesan "Sayonara" dengan nama (atau nomor jika nama tidak ada)
                const sayonaraText = `Sayonara, ${nameOrNumber}!`;

                if (profilePicUrl) {
                    // Dynamic import node-fetch karena node-fetch sudah ESM
                    const { default: fetch } = await import('node-fetch');
                    const res = await fetch(profilePicUrl);
                    const arrayBuffer = await res.arrayBuffer();
                    const buffer = Buffer.from(arrayBuffer);

                    const media = new MessageMedia(
                        res.headers.get('content-type'),
                        buffer.toString('base64')
                    );
                    await chat.sendMessage(media, { caption: sayonaraText });
                } else {
                    // Jika foto tidak tersedia, kirim pesan teks saja
                    await chat.sendMessage(sayonaraText);
                }
            } catch (err) {
                console.error('Gagal mendapatkan informasi kontak:', err.message);
                // Fallback: jika gagal, gunakan nomor saja
                await chat.sendMessage(`Sayonara, ${number}!`);
            }
        }
    } catch (error) {
        console.error('Gagal memproses notifikasi keluar group:', error.message);
    }
}

async function handleClaim(message) {
    const chat = await message.getChat();

    // Validasi: Pastikan chat adalah grup
    if (chat.id.server !== 'g.us') {
        return message.reply('Perintah ini hanya dapat digunakan di dalam grup.');
    }


    const response = `MEDIUM PACKAGE
Nick :
1Pcs - Epic Weapon+7 : 
1Pcs - Iridium Weapon+7 : 
1Pcs - Leon Low Knife / Bow Lv.40
1Pcs - Iridium Armor+7 : 
1Pcs - Iridium Scream Mask+7 : 
1Pcs - Epic Shield+7 / Sub Shield
1Pcs - Iridium Booster+7 : 
4Pcs - Epic Elemental :`;

    await message.reply(response);
}

async function handleClaimHigh(message) {
    const chat = await message.getChat();

    // Validasi: Pastikan chat adalah grup
    if (chat.id.server !== 'g.us') {
        return message.reply('Perintah ini hanya dapat digunakan di dalam grup.');
    }


    const response = `Nick : 
[1] Epic Weapon 1 [+7/7 Ignorant]	:
[2] Epic Weapon 2 [+7/7 Ignorant]	:
[3] Epic Leon High [+7/7 Chaos]: 
8 Pcs Epic Armor +7/7	: 
1 Pcs Epic Mask	: 
1 Pcs Epic Shield :
1 Pcs Epic Booster [+7/7 Chaos]	: 
2 Pcs Epic Elemental Amulet	: 
2 Pcs Epic Elemental Ring	: 
1 Pcs Epic Wind Knife                :
50 Pcs Epic Potion 01
50 Pcs Epic Potion 02
1 Pcs Separation Jade`;

    await message.reply(response);
}

async function handleDiscord(message) {
    let connection;
    try {
        connection = await pool.getConnection();
        const [rows] = await connection.query('SELECT link FROM discord_links ORDER BY created_at DESC LIMIT 1');

        if (rows.length > 0) {
            return rows[0].link;  // Mengembalikan link Discord terakhir yang disimpan
        } else {
            return 'Link Discord belum diset.';
        }
    } catch (error) {
        console.error('Gagal mengambil link Discord:', error);
        return 'Terjadi kesalahan saat mengambil link Discord.';
    } finally {
        if (connection) connection.release();
    }
}


async function handleNick(message) {
    const chat = await message.getChat();
    const msg = message.body.trim();

    // Memeriksa apakah pesan dimulai dengan "Nick:" dan terdapat data setelah titik dua
    if (msg.startsWith('Nick:') && msg.split(':')[1]?.trim()) {
        // Tentukan nomor tujuan untuk meneruskan pesan
        const targetNumber = '083829314436@c.us';  // Gantilah dengan nomor tujuan yang Anda tuju

        try {
            // Mendapatkan ID chat tujuan
            const targetChat = await chat.getChatById(targetNumber);
            if (targetChat) {
                // Kirim pesan ke nomor tujuan
                await targetChat.sendMessage(message.body);
                console.log('Pesan berhasil diteruskan ke nomor:', targetNumber);
            } else {
                console.error('Chat tujuan tidak ditemukan.');
            }
        } catch (error) {
            console.error('Gagal meneruskan pesan:', error);
        }
    } else {
        message.reply('Format perintah Nick salah! Gunakan format: Nick: [Nick]');
    }
}

async function setDiscordLink(link) {
    let connection;
    try {
        connection = await pool.getConnection();
        const [result] = await connection.query(
            'INSERT INTO discord_links (link) VALUES (?)',
            [link]
        );
        return `Link Discord berhasil disimpan dengan ID ${result.insertId}.`;
    } catch (error) {
        console.error('Gagal menyimpan link Discord:', error);
        return 'Terjadi kesalahan saat menyimpan link Discord.';
    } finally {
        if (connection) connection.release();
    }
}


async function handleStatusChip(message) {
    try {
        // Launch Puppeteer with stealth plugin enabled
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.goto('https://epic.gamecp.net/web_api/?do=satu', { waitUntil: 'domcontentloaded' });

        const content = await page.evaluate(() => {
            const preTag = document.querySelector('pre');
            return preTag ? preTag.innerText : null;
        });

        await browser.close();

        if (content) {
            // Try to parse the content as JSON
            try {
                const data = JSON.parse(content);

                const result = data.result;

                const serverStatus = result.status_game || 'OFFLINE';
                const usersOnline = result.online_field || '0';
                const oreMiningProgress = result.orepercent || '0';
                const accretiaChipProgress = result.chip_a || '0';
                const bellatoChipProgress = result.chip_b || '0';
                const coraChipProgress = result.chip_c || '0';
                const winChip = result.win_race || 'No data';
                const loseChip = result.lose_race || 'No data';
                const cbChip = result.cb_name || 'No data';

                const statusMessage = `
*Server Status*: ${serverStatus}
*Users Online*: ${usersOnline}
*Ore Mining Progress*: ${oreMiningProgress}%
*Accretia Chip Progress*: ${accretiaChipProgress}%
*Bellato Chip Progress*: ${bellatoChipProgress}%
*Cora Chip Progress*: ${coraChipProgress}%
*Win Chip*: ${winChip}
*Lose Chip*: ${loseChip}
*CB Chip*: ${cbChip}
                `;

                // Mengirim pesan ke WhatsApp
                await message.reply(statusMessage);
            } catch (jsonError) {
                console.error('Error parsing JSON:', jsonError);
                await message.reply('Ada masalah dalam mengambil data dari server. Coba lagi nanti.');
            }
        } else {
            console.error('No <pre> tag found on the page');
            await message.reply('Tidak dapat menemukan data dari server. Coba lagi nanti.');
        }

    } catch (error) {
        console.error('Error mengambil data:', error);
        await message.reply('Ada kesalahan dalam mengambil data. Coba lagi nanti!'.error);
    }
}

let lastKnownStatus = null;
let isMonitoringStarted = false;
let intervalRef = null;


function startGameStatusMonitor(client) {
    if (isMonitoringStarted) return;
    isMonitoringStarted = true;

    intervalRef = setInterval(async () => {
        let browser;
        try {
            browser = await puppeteer.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });

            const page = await browser.newPage();
            await page.goto('https://epic.gamecp.net/web_api/?do=satu', {
                waitUntil: 'domcontentloaded',
                timeout: 15000
            });

            const content = await page.evaluate(() => {
                const preTag = document.querySelector('pre');
                return preTag ? preTag.innerText : null;
            });

            await browser.close();

            if (!content) return;

            const data = JSON.parse(content);
            const status = data?.result?.status_game;
            if (!status) return;

            if (status !== lastKnownStatus) {
                lastKnownStatus = status;

                const timeNow = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
                let message;

                if (status === 'ONLINE') {
                    message = `⚔️ *RF EPIC PVP sudah UP!*\n\n🔥 Server siap tempur. Ajak tim, login, dan langsung GAS WAR!\n\n🕒 ${timeNow}`;
                } else if (status === 'OFFLINE') {
                    message = `🔧 *RF EPIC PVP sedang DOWN*\n\nServer dalam kondisi mati/maintenance.\nCek berkala untuk update selanjutnya.\n\n🕒 ${timeNow}`;
                } else {
                    message = `📡 *Status RF EPIC PVP berubah*\nStatus sekarang: *${status}*\n\n🕒 ${timeNow}`;
                }

                const targetNumber = '120363042863310424@g.us';
                const chat = await client.getChatById(targetNumber);
                await chat.sendMessage(message);

                console.log(`[RF STATUS MONITOR] Kirim notifikasi status: ${status}`);
            }

        } catch (err) {
            console.error('[RF MONITOR ERROR]:', err.message);
            if (browser) await browser.close();
        }
    }, 30 * 1000);
}

async function stopGameStatusMonitor(message) {
    if (!isMonitoringStarted || !intervalRef) {
        await message.reply('🔕 Monitor belum aktif.');
        return;
    }

    clearInterval(intervalRef);
    intervalRef = null;
    isMonitoringStarted = false;
    lastKnownStatus = null;

    await message.reply('🛑 Monitor RF EPIC PVP telah *dimatikan*.');
}

async function handleUpdateLogs(message) {
    let browser;

    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.goto('https://www.epicfullpvp.com/update-logs/', {
            waitUntil: 'domcontentloaded',
            timeout: 20000
        });

        const updateList = await page.evaluate(() => {
            const timeline = document.querySelector('ul.timeline-with-icons');
            if (!timeline) return [];

            const firstItem = timeline.querySelector('li');
            if (!firstItem) return [];

            const nestedUl = firstItem.querySelector('ul');
            if (!nestedUl) return [];

            const items = nestedUl.querySelectorAll('li');
            return Array.from(items).map(li => li.innerText.trim());
        });

        await browser.close();

        if (updateList.length === 0) {
            await message.reply('⚠️ Tidak ditemukan data update log terbaru.');
            return;
        }

        const replyText = `📋 *Update Log Terbaru RF EPIC PVP*\n\n${updateList.map((line, idx) => `${idx + 1}. ${line}`).join('\n')}`;
        await message.reply(replyText);

    } catch (err) {
        console.error('[SCRAPER ERROR - UpdateLogs]:', err.message);
        if (browser) await browser.close();
        await message.reply('❌ Gagal mengambil data update log. Coba lagi nanti.');
    }
}

async function getSpawnPredictions() {
    const now = new Date();
    const formatDate = (date) => date.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

    // Fetch all pitboss states from DB
    const allStates = await pool.query('SELECT map_code, boss_name, last_status, last_checked FROM pitboss_state')
        .then(([rows]) => rows);

    // Helper spawn calculators (reuse existing logic)
    const computeNextMassalSpawn = (baseTime) => {
        const massalHours = [2, 6, 10, 14, 18, 22];
        let nextMassal;
        for (const h of massalHours) {
            const cand = new Date(baseTime);
            cand.setHours(h, 31, 47, 0);
            if (cand > baseTime) {
                nextMassal = cand;
                break;
            }
        }
        if (!nextMassal) {
            nextMassal = new Date(baseTime);
            nextMassal.setDate(baseTime.getDate() + 1);
            nextMassal.setHours(massalHours[0], 31, 47, 0);
        }
        return nextMassal;
    };
    const computeNextRandomSpawn = (lastDead) => {
        const next = new Date(lastDead);
        next.setMinutes(56, 20, 0);
        if (next <= lastDead) next.setHours(next.getHours() + 1);
        return next;
    };
    const computeNextBelpeSpawn = (lastDead) => {
        const isOdd = (n) => n % 2 === 1;
        const nowBD = new Date(lastDead);
        const h = nowBD.getHours(), m = nowBD.getMinutes(), s = nowBD.getSeconds();
        let next;
        if (isOdd(h) && (m < 15 || (m === 15 && s < 4))) {
            next = new Date(nowBD);
            next.setHours(h, 15, 4, 0);
        } else {
            const nextOdd = isOdd(h) ? h + 2 : h + 1;
            next = new Date(nowBD);
            next.setHours(nextOdd, 15, 4, 0);
        }
        return next;
    };
    const computeNextUrsaSpawn = (lastDead) => {
        const isOdd = (n) => n % 2 === 1;
        const nowUD = new Date(lastDead);
        const h = nowUD.getHours(), m = nowUD.getMinutes(), s = nowUD.getSeconds();
        let next;
        if (isOdd(h) && (m < 36 || (m === 36 && s < 15))) {
            next = new Date(nowUD);
            next.setHours(h, 36, 15, 0);
        } else {
            const nextOdd = isOdd(h) ? h + 2 : h + 1;
            next = new Date(nowUD);
            next.setHours(nextOdd, 36, 15, 0);
        }
        return next;
    };
    const computeNextElanSpawn = (baseTime) => {
        const next = new Date(baseTime);
        next.setHours(20, 15, 0, 0);
        if (next <= baseTime) next.setDate(next.getDate() + 1);
        return next;
    };
    const computeNext3dSpawn = (baseTime) => {
        const next = new Date(baseTime);
        next.setHours(20, 30, 0, 0);
        if (next <= baseTime) next.setDate(next.getDate() + 1);
        return next;
    };

    const lines = [];
    lines.push('⏰ *Prediksi Spawn Pit Boss*');
    lines.push('');

    // Build dynamic categories from database entries
    const mapGroups = {};
    for (const state of allStates) {
        if (!mapGroups[state.map_code]) {
            mapGroups[state.map_code] = [];
        }
        mapGroups[state.map_code].push(state);
    }

    for (const [mapCode, stateList] of Object.entries(mapGroups)) {
        const displayName = mapCode.toUpperCase();
        lines.push(`🔹 *${displayName}*`);

        for (const state of stateList) {
            const bossName = state.boss_name;
            const status = state.last_status;
            const lastDead = new Date(state.last_checked);

            if (status === 'ALIVE') {
                lines.push(`- 🔥 ${bossName} (ALIVE)`);
                lines.push(`  • Last Dead: ${formatDate(lastDead)}`);
            } else if (status === 'DEAD') {
                lines.push(`- 💀 ${bossName} (DEAD)`);
                // Compute nextSpawn based on map category
                let nextSpawn = null;
                if (mapCode === 'massal') {
                    nextSpawn = computeNextMassalSpawn(lastDead);
                } else if (mapCode.startsWith('neutral')) {
                    nextSpawn = computeNextRandomSpawn(lastDead);
                } else if (mapCode === 'cauldron01') {
                    nextSpawn = computeNextBelpeSpawn(lastDead);
                } else if (mapCode === 'elan') {
                    nextSpawn = computeNextElanSpawn(new Date());
                }
                // Add other mapCode conditions if needed

                if (nextSpawn) {
                    lines.push(`  • Predict Spawn: ${formatDate(nextSpawn)}`);
                }
            }
            lines.push('');
        }
    }

    return lines.join('\n');
}


module.exports = {
    handleGroupJoin,
    handleClaim,
    handleClaimHigh,
    handleGroupLeave,
    handleNick,
    handleDiscord,
    handleStatusChip,
    setDiscordLink,
    startGameStatusMonitor,
    stopGameStatusMonitor,
    handleUpdateLogs,
    getSpawnPredictions
};
