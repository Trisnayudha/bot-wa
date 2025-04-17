const messageController = require('../controllers/messageController');
const guildController = require('../controllers/guildController');
const OpenAIService = require('../openai/openaiService');

class MessageRoutes {
    async routeMessage(message) {
        const chat = await message.getChat();
        const msg = message.body;

        // Periksa apakah pesan berasal dari grup dengan ID tertentu
        if (chat.id._serialized === '120363042863310424@g.us' || chat.id._serialized === '120363040158938647@g.us') {
            if (msg.toLowerCase() === 'claim') {
                await guildController.handleClaim(message);
                return;
            }

            if (msg.toLowerCase() === 'discord') {
                await guildController.handleDiscord(message);
            }
            if (msg.toLowerCase() === '.statuschip') {
                // Memanggil fungsi handleStatusChip jika pesan adalah .statusChip
                await guildController.handleStatusChip(message);
            }
        }
        // Logika lainnya untuk pesan dari grup atau chat lain
        const lowerMsg = msg.toLowerCase();

        if (lowerMsg.startsWith('/info')) {
            messageController.handleInfo(message);
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
        } else if (lowerMsg.startsWith('.ai')) {
            const question = msg.slice(4).trim();
            if (question) {
                const response = await OpenAIService.getResponse(question);
                message.reply(response);
            } else {
                message.reply('Silakan masukkan pertanyaan setelah /ask.');
            }
        }
    }


}

module.exports = new MessageRoutes();
