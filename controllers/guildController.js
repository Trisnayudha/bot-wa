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


    const response = `Nick: 
Race: Bells
2 PCS Ancient Weapon : 
1 Set Ancient Armor : 
1 Set Ancient Elemental : 
Mask Divine : 
Booster Divine : 
1 PCS Ancient Booster : 
1 PCS Ancient Shield : 
1 PCS Ancient Mask : 
1 PCS Leon Weapon :
1 PCS Jade Level Permanent
Mask Divine :  
Booster Divine :`;

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
        await page.goto('https://kairos.gamecp.net/web_api/?do=satu', { waitUntil: 'domcontentloaded' });

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

module.exports = {
    handleGroupJoin,
    handleClaim,
    handleGroupLeave,
    handleNick,
    handleDiscord,
    handleStatusChip,
    setDiscordLink
};
