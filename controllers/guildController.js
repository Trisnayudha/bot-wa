const { MessageMedia } = require('whatsapp-web.js');

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
Race: 
2 PCS Ancient Weapon: 
1 Set Ancient Armor: 
1 Set Ancient Elemental: 
Mask Divine: 
Booster Divine: 
1 PCS Ancient Booster: 
1 PCS Ancient Shield: 
1 PCS Ancient Mask: 
1 PCS Leon Weapon: 
1 PCS Jade Level Permanent
Mask Divine: 
Booster Divine:`;

    await message.reply(response);
}

async function handleDiscord(message) {
    const chat = await message.getChat();

    const response = `https://discord.gg/4w86x6gG`;

    await message.reply(response);
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


module.exports = {
    handleGroupJoin,
    handleClaim,
    handleGroupLeave,
    handleNick,
    handleDiscord
};
