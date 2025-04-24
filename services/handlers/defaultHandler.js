// services/handlers/defaultHandler.js

const DeepSeekService = require('../../openai/openaiService');

class DefaultHandler {
    constructor(client, schedule) {
        this.client = client;
        this.schedule = schedule;
    }

    async handle() {
        try {
            let message;

            if (this.schedule.use_ai && this.schedule.ai_prompt) {
                console.log(`🤖 Generate AI message untuk jadwal ID ${this.schedule.id}`);
                // Generate dari AI pakai ai_prompt (sama seperti PersonalHandler)
                message = await DeepSeekService.generateScheduleMessage(this.schedule.ai_prompt);
            } else if (this.schedule.message) {
                console.log(`📨 Menggunakan pesan statis untuk jadwal ID ${this.schedule.id}`);
                message = this.schedule.message;
            } else {
                console.warn(`❗ Jadwal ID ${this.schedule.id} tidak punya ai_prompt maupun message.`);
                return;
            }

            const chat = await this.client.getChatById(this.schedule.chat_id);

            if (this.schedule.chat_id.endsWith('@g.us')) {
                // Group: mention semua peserta
                const mentions = chat.participants.map(p => p.id._serialized);
                await chat.sendMessage(message, { mentions });
                console.log(`✅ Pesan group terkirim ke ${chat.id._serialized}`);
            } else {
                // Personal chat
                await this.client.sendMessage(chat.id._serialized, message);
                console.log(`✅ Pesan personal terkirim ke ${chat.id._serialized}`);
            }

        } catch (error) {
            console.error(`❌ Error di DefaultHandler ID ${this.schedule.id}:`, error);
        }
    }
}

module.exports = DefaultHandler;
