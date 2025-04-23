class DefaultHandler {
    constructor(client, schedule) {
        this.client = client;
        this.schedule = schedule;
    }

    async handle() {
        const message = this.schedule.message; // Pesan statis dari DB

        if (!message) {
            console.warn(`❗ Jadwal ID ${this.schedule.id} tidak punya message.`);
            return;
        }

        const chat = await this.client.getChatById(this.schedule.chat_id);
        if (this.schedule.chat_id.endsWith('@g.us')) {
            const mentions = chat.participants.map(p => p.id._serialized);
            await chat.sendMessage(message, { mentions });
        } else {
            await this.client.sendMessage(this.schedule.chat_id, message);
        }
    }
}

module.exports = DefaultHandler;
