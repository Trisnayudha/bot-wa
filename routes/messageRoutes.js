const messageController = require('../controllers/messageController');
const guildController = require('../controllers/guildController');
const eventController = require('../controllers/eventController');
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
            chat.id._serialized === '120363040158938647@g.us' ||
            chat.id._serialized === '120363421048716633@g.us'
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
                const discordLink = await guildController.handleDiscord();
                await message.reply(discordLink);
                return;
            }

            if (lowerMsg === '.statuschip') {
                await guildController.handleStatusChip(message);
                return;
            }

            if (lowerMsg === '.pb') {
                try {
                    const predictionText = await guildController.getSpawnPredictions();
                    await message.reply(predictionText);
                } catch (err) {
                    console.error('Error saat generate spawn predictions:', err);
                    await message.reply('❌ Gagal mengambil prediksi spawn. Coba lagi nanti.');
                }
                return;
            }

            // ===== MONITOR SERVER RF EPIC =====
            if (lowerMsg === '.onserver') {
                guildController.startGameStatusMonitor(this.client);
                await message.reply('✅ Monitor Server RF Strom *sudah diaktifkan*.');
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

        // ===== .SETDISCORD <link> =====
        if (lowerMsg.startsWith('.setdiscord')) {
            const link = msg.slice(12).trim();
            if (link) {
                const response = await guildController.setDiscordLink(link);
                await message.reply(response);
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

            if (typeof imageUrl === 'string' && imageUrl.startsWith('http')) {
                try {
                    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
                    const mimeType = response.headers['content-type'];
                    const imageBuffer = Buffer.from(response.data, 'binary');
                    const base64Image = imageBuffer.toString('base64');
                    const media = new MessageMedia(mimeType, base64Image, 'ai-image.png');
                    await message.reply(media);
                } catch (err) {
                    console.error('Gagal kirim gambar:', err.message);
                    await message.reply('Gambarnya udah jadi, tapi gagal ngirim.');
                }
            } else {
                await message.reply(imageUrl || 'Gagal generate gambar, coba lagi.');
            }
            return;
        }

        // ===== PERINTAH AI TEKS (.ai = Jaksel) =====
        if (lowerMsg.startsWith('.ai')) {
            const question = msg.slice(4).trim();
            if (question) {
                try {
                    const isReply = message.hasQuotedMsg === true;
                    const isJaksel = true;
                    const response = await OpenAIService.getResponse(question, chat.id._serialized, isReply, isJaksel);
                    await message.reply(response);
                } catch (error) {
                    await message.reply('Yah error pas jawab pertanyaan, coba lagi.');
                }
            } else {
                await message.reply('Silakan masukin pertanyaan setelah .ai');
            }
            return;
        }

        // ===== /ask (Formal) =====
        if (lowerMsg.startsWith('/ask')) {
            const question = msg.slice(5).trim();
            if (question) {
                try {
                    const isReply = message.hasQuotedMsg === true;
                    const isJaksel = false;
                    const response = await OpenAIService.getResponse(question, chat.id._serialized, isReply, isJaksel);
                    await message.reply(response);
                } catch (error) {
                    await message.reply('Yah error pas jawab pertanyaan, coba lagi.');
                }
            } else {
                await message.reply('Silakan masukin pertanyaan setelah /ask');
            }
            return;
        }

        // ===== ATTENDANCE (SQL lokal) =====
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
                    let txt = '*Attendance Summary (Day 1)*\n';
                    for (const row of rows) {
                        txt += `• ${row.ticket_title}: ${row.count}\n`;
                        totalCheckins += row.count;
                    }
                    txt += `\n*Total Check-ins*: ${totalCheckins}`;
                    await message.reply(txt.trim());
                }
            } catch (err) {
                console.error('Error fetching attendance data:', err);
                await message.reply('❌ Gagal mengambil data attendance. Coba lagi nanti.');
            }
            return;
        }

        // ===== PESERTA & DETAIL (simple; tanpa pagination) =====
        // Command yang diterima:
        //   .peserta
        //   /peserta
        //   .participants
        //   /participants
        //   .detail <code> [event_id]
        //   /detail  <code> [event_id]
        //   (alias lama tetap: /participant <code> [event_id])

        // default event id → ENV atau 55
        const DEFAULT_EVENT_ID = parseInt(process.env.EVENT_DEFAULT_ID || '55', 10);

        // --- LIST ---
        // Bentuk: ".peserta", "/peserta", ".participants 55", "/participants 13", dll.
        // Jika event_id tidak diberikan → pakai DEFAULT_EVENT_ID
        let listCmd = msg.match(/^(?:\/|\.)?(?:peserta|participants)\b(?:\s+(\d+))?$/i);
        if (listCmd) {
            console.log(listCmd);
            const eventsId = listCmd[1] ? parseInt(listCmd[1], 10) : DEFAULT_EVENT_ID;
            if (!Number.isFinite(eventsId)) {
                await message.reply('Format: .peserta 55  (event_id opsional; default 55)');
                return;
            }
            try {
                await eventController.handleListParticipants(message, { eventsId });
            } catch (err) {
                console.error('Error handleListParticipants:', err);
                await message.reply('❌ Gagal mengambil daftar peserta.');
            }
            return;
        }

        // --- DETAIL ---
        // Bentuk: ".detail MGHEXVB [55]" / "/detail MGHEXVB [55]" / "/participant MGHEXVB [55]"
        let detCmd = msg.match(/^(?:\/|\.)?(?:detail|participant|peserta_detail)\b\s+([^\s]+)(?:\s+(\d+))?$/i);
        if (detCmd) {
            const codepayment = (detCmd[1] || '').trim();
            const eventsId = detCmd[2] ? parseInt(detCmd[2], 10) : DEFAULT_EVENT_ID;

            if (!codepayment) {
                await message.reply('Format: .detail <codepayment> [event_id]\nContoh: .detail MGHEXVB 55');
                return;
            }
            try {
                await eventController.handleParticipantDetail(message, { codepayment, eventsId });
            } catch (err) {
                console.error('Error handleParticipantDetail:', err);
                await message.reply('❌ Gagal mengambil detail peserta.');
            }
            return;
        }

        // ===== CHECK-IN SUMMARY (on-demand) =====
        // Bentuk: ".checkin [event_id]" / "/checkin [event_id]" / ".ci [event_id]"
        let checkinCmd = msg.match(/^(?:\/|\.)?(?:checkin|ci)\b(?:\s+(\d+))?$/i);
        if (checkinCmd) {
            const eventsId = checkinCmd[1] ? parseInt(checkinCmd[1], 10) : DEFAULT_EVENT_ID;
            function randTag(length = 6) {
                const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
                let result = '';
                for (let i = 0; i < length; i++) {
                    result += chars.charAt(Math.floor(Math.random() * chars.length));
                }
                return result;
            }

            const apiUrl = 'https://membership.djakarta-miningclub.com/api/summary-attandance';
            const tag = randTag();

            try {
                const { data: rows } = await axios.post(apiUrl, { event_id: eventsId }, { timeout: 15000 });

                let totalCheckins = 0;
                let txt = `*DMC Check-in Summary* [${tag}]\nEvent ID: ${eventsId}\n`;

                if (!rows || rows.length === 0) {
                    txt += 'Belum ada data check-in.\n';
                } else {
                    for (const row of rows) {
                        const cat = (row.package_category || '').toString();
                        const count = Number(row.count || 0);
                        totalCheckins += count;
                        txt += `• ${cat}: ${count}\n`;
                    }
                }

                const now = new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' });
                txt += `\n*Total Checked-in*: ${totalCheckins}`;
                txt += `\n*Update Terakhir*: ${now}`;
                txt += `\nRef: ${tag}`;

                await message.reply(txt.trim());
            } catch (err) {
                console.error('❌ Gagal ambil Check-in Summary (POST):', err?.message || err);
                if (err?.response) {
                    console.error('API Response Data:', err.response.data);
                    console.error('API Response Status:', err.response.status);
                }
                await message.reply('❌ Gagal mengambil data check-in summary.');
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
            await messageController.handleTagAll(message);
        } else if (lowerMsg === '/groupid') {
            await messageController.handleGroupId(message);
        } else if (lowerMsg === '.menu') {
            await messageController.handleMenu(message);
        }
    }
}

module.exports = new MessageRoutes();
