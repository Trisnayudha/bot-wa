const db = require('../models/database');

function formatToIDR(amount) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(amount);
}

class MessageController {
    constructor() {
        this.lastHidetagTime = {};
        this.cooldownMs = 2 * 60 * 1000; // 2 menit
    }
    isAuthor(message) {
        const senderNumber = message.author ? message.author.split('@')[0] : message.from.split('@')[0];
        const allowedAuthor = '6283829314436';
        return senderNumber === allowedAuthor;
    }

    async handleTagAll(message) {
        const chat = await message.getChat();

        // Validasi: Pastikan chat adalah grup
        if (chat.id.server !== 'g.us') {
            return message.reply('Perintah ini hanya dapat digunakan di dalam grup.');
        }

        const msg = message.body;
        const chatId = chat.id._serialized;
        const now = Date.now();

        // Periksa apakah pesan dimulai dengan '@everyone' atau '.hidetag'
        if (msg.includes('@everyone')) {
            // Ambil daftar ID peserta
            const mentions = chat.participants.map(p => p.id._serialized);

            // Kirim pesan dengan mention ke semua anggota grup
            await chat.sendMessage(msg, { mentions });

        } else if (msg.startsWith('.hidetag')) {
            // Cek cooldown
            if (
                this.lastHidetagTime[chatId] &&
                now - this.lastHidetagTime[chatId] < this.cooldownMs
            ) {
                const remainingSec = Math.ceil(
                    (this.cooldownMs - (now - this.lastHidetagTime[chatId])) / 1000
                );
                return message.reply(`Tunggu ${remainingSec} detik sebelum menggunakan .hidetag lagi.`);
            }

            this.lastHidetagTime[chatId] = now;

            // Ambil daftar ID peserta
            const mentions = chat.participants.map(p => p.id._serialized);

            // Hapus perintah '.hidetag' dari awal pesan
            const content = msg.replace(/^\.hidetag\s*/i, '');
            await chat.sendMessage(content, { mentions });
        }
    }


    async handleGroupId(message) {
        const chat = await message.getChat();
        console.log(chat)
        if (chat) {
            message.reply(`ID grup ini adalah: ${chat.id._serialized}`);
        } else {
            message.reply('Perintah ini hanya dapat digunakan di dalam grup.');
        }
    }

    async handleInfo(message) {
        console.log(message)
        const infoText = `
Berikut adalah perintah yang tersedia:
1. /event delegate - Menampilkan informasi delegate dari database.
2. /total revenue - Menampilkan total pendapatan.
3. /monthly revenue - Menampilkan total pendapatan per bulan.
4. @everyone - Mention semua anggota grup.
5. /groupid - Mendapatkan ID grup.
        `;
        message.reply(infoText);
    }

    async handleEventDelegate(message) {
        const isAuthor = this.isAuthor(message);

        if (!isAuthor) {
            message.reply('Maaf, hanya author yang diizinkan untuk mengeksekusi perintah ini.');
            return;
        }

        const results = await db.getEventDelegate();
        if (results.length > 0) {
            let response = 'Informasi Delegate:\n';
            results.forEach((row, index) => {
                response += `${index + 1}. Nama: ${row.name}, Perusahaan: ${row.company_name}, Harga Event: ${formatToIDR(row.event_price)}\n`;
            });
            message.reply(response);
        } else {
            message.reply('Tidak ada data delegate yang ditemukan dengan status "Paid Off".');
        }
    }

    async handleTotalRevenue(message) {
        const isAuthor = this.isAuthor(message);

        if (!isAuthor) {
            message.reply('Maaf, hanya author yang diizinkan untuk mengeksekusi perintah ini.');
            return;
        }

        const totalRevenue = await db.getTotalRevenue();
        const formattedTotalRevenue = formatToIDR(totalRevenue.total);
        message.reply(`Total pendapatan seluruh: ${formattedTotalRevenue}`);
    }

    async handleMonthlyRevenue(message) {
        const isAuthor = this.isAuthor(message);

        if (!isAuthor) {
            message.reply('Maaf, hanya author yang diizinkan untuk mengeksekusi perintah ini.');
            return;
        }

        const monthlyRevenue = await db.getMonthlyRevenue();
        if (monthlyRevenue.length > 0) {
            let response = 'Total pendapatan per bulan:\n';
            monthlyRevenue.forEach((row, index) => {
                const formattedRevenue = formatToIDR(row.total);
                response += `${index + 1}. Bulan: ${row.month}, Total: ${formattedRevenue}\n`;
            });
            message.reply(response);
        } else {
            message.reply('Tidak ada data pendapatan per bulan.');
        }
    }
    async handleMenu(message) {
        const menuText = `
📋 *DAFTAR MENU BOT GUILD* 📋
        
Berikut adalah command yang bisa kamu gunakan di grup:
    
🔹 *.hidetag <pesan>*  
 _➤ Mention semua member tanpa terlihat_  
Contoh: *.hidetag Jangan lupa war jam 8 malam ya!*
    
🔹 *.setdiscord <link>*  
_➤ Simpan link Discord terbaru ke database_  
Contoh: *.setdiscord https://discord.gg/abc123*
    
🔹 *discord*  
_➤ Tampilkan link Discord yang tersimpan_
    
🔹 *.menu*  
 _➤ Menampilkan daftar semua perintah yang tersedia_
    
🔹 *claim*  
_➤ Klaim GPACK hadiah guild_
    
🔹 *.ai <prompt>*  
_➤ Tanya ke AI dengan gaya anak Jaksel_  
Contoh: *.ai gimana caranya biar gue gak insecure pas war?*
    
🔹 */ask <prompt>*  
_➤ Tanya ke AI dengan bahasa formal_  
Contoh: /ask Bagaimana cara meningkatkan performa tim dalam event?
    
🔹 *.ai buatkan saya gambar <deskripsi>*  
_➤ Generate gambar berdasarkan deskripsi_  
Contoh: *.ai buatkan saya gambar naga terbang di langit*  
⚠️ *Batas: Maks. 3 gambar per hari per grup*
    
🔹 *.statuschip*  
_➤ Melihat status server saat ini_
    
🔹 *.onserver*  
_➤ Aktifkan pemantauan otomatis status RF EPIC tiap 30 detik_
    
🔹 *.offserver*  
_➤ Nonaktifkan pemantauan status RF EPIC_
    
🔹 *.updatelogs*  
_➤ Menampilkan update log terbaru dari RF EPIC_
    
💡 Catatan:
Semua command ini hanya berfungsi jika digunakan di grup yang terdaftar.
        `;
        await message.reply(menuText);
    }




}

module.exports = new MessageController();
