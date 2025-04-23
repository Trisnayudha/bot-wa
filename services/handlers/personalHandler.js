const DeepSeekService = require('../../openai/openaiService');

class PersonalHandler {
    constructor(client, schedule) {
        this.client = client;
        this.schedule = schedule;
    }

    async handle() {
        try {
            let message;

            if (this.schedule.use_ai && this.schedule.ai_prompt) {
                console.log(`🤖 Generate AI message untuk personal jadwal ID ${this.schedule.id}`);
                // Generate dari AI (pakai ai_prompt)
                message = await DeepSeekService.generateScheduleMessage(this.schedule.ai_prompt);
            } else if (this.schedule.message) {
                console.log(`📨 Menggunakan pesan statis untuk personal jadwal ID ${this.schedule.id}`);
                // Pakai message statis
                message = this.schedule.message;
            } else {
                console.warn(`❗ Jadwal ID ${this.schedule.id} tidak punya pesan (baik AI maupun statis).`);
                return;
            }

            // Kirim ke personal chat
            const chat = await this.client.getChatById(this.schedule.chat_id);
            await this.client.sendMessage(chat.id._serialized, message);

            console.log(`💌 Pesan personal terkirim ke ${chat.id._serialized}`);
        } catch (error) {
            console.error(`❌ Error kirim pesan personal jadwal ID ${this.schedule.id}:`, error);
        }
    }
}

module.exports = PersonalHandler;
