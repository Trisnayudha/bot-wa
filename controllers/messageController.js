const db = require('../models/database');

function formatToIDR(amount) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(amount);
}

class MessageController {
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
    
        // Periksa apakah pesan dimulai dengan '@everyone'
        if (!message.body.startsWith('@everyone')) {
            console.log('error')
            return; // Tidak melakukan apa-apa jika tidak dimulai dengan '@everyone'
        }
    
        // Ambil daftar ID peserta
        const mentions = chat.participants.map(p => p.id._serialized);
    
        // Kirim pesan dengan mention ke semua anggota grup
        await chat.sendMessage(message.body, {
            mentions
        });
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
        const infoText = `
        Berikut adalah perintah yang tersedia:
        1. /event delegate - Menampilkan informasi delegate dari database.
        2. /total revenue - Menampilkan total pendapatan.
        3. /monthly revenue - Menampilkan total pendapatan per bulan.
        4. !bot tagall - Mention semua anggota grup.
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
}

module.exports = new MessageController();
