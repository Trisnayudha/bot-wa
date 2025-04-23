class DefaultHandler {
    constructor(client, schedule) {
        this.client = client;
        this.schedule = schedule;
    }

    async handle() {
        try {
            const message = this.schedule.message;

            if (!message) {
                console.warn(`❗ Jadwal ID ${this.schedule.id} tidak punya message statis.`);
                return;
            }

            const chat = await this.client.getChatById(this.schedule.chat_id);

            if (this.schedule.chat_id.endsWith('@g.us')) {
                const mentions = chat.participants.map(p => p.id._serialized);
                await chat.sendMessage(message, { mentions });
                console.log(`📨 Pesan statis (group) terkirim ke ${chat.id._serialized}`);
            } else {
                await this.client.sendMessage(chat.id._serialized, message);
                console.log(`📨 Pesan statis (personal) terkirim ke ${chat.id._serialized}`);
            }

        } catch (error) {
            console.error(`❌ Error kirim pesan statis jadwal ID ${this.schedule.id}:`, error);
        }
    }
}

module.exports = DefaultHandler;
