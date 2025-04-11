const messageController = require('../controllers/messageController');
const OpenAIService = require('../openai/openaiService');

class MessageRoutes {
    async routeMessage(message) {
        const msg = message.body.toLowerCase();

        if (msg.startsWith('/info')) {
            messageController.handleInfo(message);
        } else if (msg === '/event delegate') {
            await messageController.handleEventDelegate(message);
        } else if (msg === '/total revenue') {
            await messageController.handleTotalRevenue(message);
        } else if (msg === '/monthly revenue') {
            await messageController.handleMonthlyRevenue(message);
        }else if (msg.startsWith('@everyone')) {
            await messageController.handleTagAll(message);
        }
        // Perintah baru: /groupid
        else if (msg === '/groupid') {
            await messageController.handleGroupId(message);
        }
        // Perintah baru: /ask
        else if (msg.startsWith('/ask')) {
            const question = msg.replace('/ask', '').trim(); // Ambil pertanyaan
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
