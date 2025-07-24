const messageController = require('../controllers/messageController');
const guildController = require('../controllers/guildController');
const OpenAIService = require('../openai/openaiService');
const OpenAIImageService = require('../openai/openaiImageService');
const { MessageMedia } = require('whatsapp-web.js');
const axios = require('axios');

class MessageRoutes {
    setClient(clientInstance) {
        this.client = clientInstance;
    }

    async routeMessage(message) {
        const chat = await message.getChat();
        const msg = message.body;
        const lowerMsg = msg.toLowerCase();

        // ===== GRUP SPESIFIK HANDLER =====
        if (
            chat.id._serialized === '120363042863310424@g.us' ||
            chat.id._serialized === '120363040158938647@g.us'
        ) {
            if (lowerMsg === 'claim') {
                await guildController.handleClaim(message);
                return;
            }
            if (lowerMsg === 'high') {
                await guildController.handleClaimHigh(message);
                return;
            }

            if (lowerMsg === 'discord') {
                const discordLink = await guildController.handleDiscord(); // Mengambil link Discord
                await message.reply(discordLink); // Mengirim link Discord ke pengguna
                return;
            }

            if (lowerMsg === '.statuschip') {
                await guildController.handleStatusChip(message);
                return;
            }

            if (lowerMsg === '.pb') {
                try {
                    // Ambil string prediksi dari guildController
                    const predictionText = await guildController.getSpawnPredictions();
                    // Kirim sebagai reply
                    await message.reply(predictionText);
                } catch (err) {
                    console.error('Error saat generate spawn predictions:', err);
                    await message.reply('❌ Gagal mengambil prediksi spawn. Coba lagi nanti.');
                }
                return;
            }

            // ===== HIDUPKAN MONITOR SERVER RF EPIC =====
            if (lowerMsg === '.onserver') {
                guildController.startGameStatusMonitor(this.client);
                await message.reply('✅ Monitor Server RF EPIC *sudah diaktifkan*.');
                return;
            }

            if (lowerMsg === '.offserver') {
                await guildController.stopGameStatusMonitor(message);
                return;
            }

            if (lowerMsg === '.updatelogs') {
                await guildController.handleUpdateLogs(message);
                return;
            }


        }

        // ===== MENANGANI PERINTAH .SETDISCORD <link> =====
        if (lowerMsg.startsWith('.setdiscord')) {
            const link = msg.slice(12).trim(); // Mengambil link setelah .setdiscord
            if (link) {
                // Menyimpan link Discord ke database
                const response = await guildController.setDiscordLink(link);
                await message.reply(response); // Kirim balasan ke pengguna
            } else {
                await message.reply('Silakan kirimkan link Discord yang valid setelah perintah .setdiscord');
            }
            return;
        }

        // ===== DETEKSI PERINTAH GAMBAR =====
        const promptGambarRegex = /\.ai\s.*?(buatkan|gambarkan|gambar)(.*?)$/i;
        const match = promptGambarRegex.exec(msg);

        if (match && match[2]) {
            const prompt = match[2].trim();
            const imageUrl = await OpenAIImageService.generateImage(prompt, chat.id._serialized);

            // ✅ Cek apakah hasilnya URL valid
            if (typeof imageUrl === 'string' && imageUrl.startsWith('http')) {
                try {
                    const response = await axios.get(imageUrl, {
                        responseType: 'arraybuffer'
                    });

                    const mimeType = response.headers['content-type'];
                    const imageBuffer = Buffer.from(response.data, 'binary');
                    const base64Image = imageBuffer.toString('base64');

                    const media = new MessageMedia(mimeType, base64Image, 'ai-image.png');
                    await message.reply(media);
                } catch (err) {
                    console.error('Gagal kirim gambar:', err.message);
                    await message.reply('Gambarnya udah jadi, tapi gagal ngirim cuy 🥲');
                }
            } else {
                // Jika gagal atau limit tercapai
                await message.reply(imageUrl || 'Gagal generate gambar, coba lagi deh.');
            }

            return;
        }


        // ===== PERINTAH AI TEKS (DEEPSEEK) =====
        if (lowerMsg.startsWith('.ai')) {
            const question = msg.slice(4).trim();
            if (question) {
                try {
                    // Cek apakah pesan merupakan reply
                    const isReply = message.hasQuotedMsg === true;
                    const isJaksel = true; // Gunakan gaya Jaksel untuk .ai
                    const response = await OpenAIService.getResponse(question, chat.id._serialized, isReply, isJaksel);
                    await message.reply(response);
                } catch (error) {
                    await message.reply('Yah error pas jawab pertanyaan, coba lagi yak.');
                }
            } else {
                await message.reply('Silakan masukin pertanyaan setelah .ai');
            }
            return;
        }

        // ===== DETEKSI PERINTAH /ASK (FORMAL) =====
        if (lowerMsg.startsWith('/ask')) {
            const question = msg.slice(5).trim();
            if (question) {
                try {
                    // Cek apakah pesan merupakan reply
                    const isReply = message.hasQuotedMsg === true;
                    const isJaksel = false; // Gunakan gaya Formal untuk /ask
                    const response = await OpenAIService.getResponse(question, chat.id._serialized, isReply, isJaksel);
                    await message.reply(response);
                } catch (error) {
                    await message.reply('Yah error pas jawab pertanyaan, coba lagi yak.');
                }
            } else {
                await message.reply('Silakan masukin pertanyaan setelah /ask');
            }
            return;
        }

        if (lowerMsg === '.attend') {
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

                let totalCheckins = 0;

                if (rows.length === 0) {
                    await message.reply('*Attendance Summary*\nBelum ada peserta yang check-in hari ini.');
                } else {
                    let message = '*Attendance Summary (Day 1)*\n';
                    for (const row of rows) {
                        message += `• ${row.ticket_title}: ${row.count}\n`;
                        totalCheckins += row.count;
                    }

                    message += `\n*Total Check-ins*: ${totalCheckins}`;

                    await message.reply(message.trim());
                }
            } catch (err) {
                console.error('Error fetching attendance data:', err);
                await message.reply('❌ Gagal mengambil data attendance. Coba lagi nanti.');
            }
            return;
        }

        // ===== COMMAND LAIN =====
        if (lowerMsg === '/info') {
            await messageController.handleInfo(message);
        } else if (lowerMsg === '/event delegate') {
            await messageController.handleEventDelegate(message);
        } else if (lowerMsg === '/total revenue') {
            await messageController.handleTotalRevenue(message);
        } else if (lowerMsg === '/monthly revenue') {
            await messageController.handleMonthlyRevenue(message);
        } else if (lowerMsg.startsWith('@everyone') || lowerMsg.startsWith('.hidetag')) {
            // await messageController.handleTagAll(message);
        } else if (lowerMsg === '/groupid') {
            await messageController.handleGroupId(message);
        } else if (lowerMsg === '.menu') {
            await messageController.handleMenu(message);
        }
    }
}

module.exports = new MessageRoutes();
