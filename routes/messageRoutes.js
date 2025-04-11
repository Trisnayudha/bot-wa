const messageController = require('../controllers/messageController');
const guildController = require('../controllers/guildController');
const OpenAIService = require('../openai/openaiService');

class MessageRoutes {
    async routeMessage(message) {
        const chat = await message.getChat();
        const msg = message.body;

        // Periksa apakah pesan berasal dari grup dengan ID tertentu
        if (chat.id._serialized === '120363419644935064@g.us') {
            if (msg === 'claim') {
                await guildController.handleClaim(message);
                return;
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
        } else if (lowerMsg.startsWith('/ask')) {
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
