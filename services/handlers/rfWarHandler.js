const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const DeepSeekService = require('../../openai/openaiService');

puppeteer.use(StealthPlugin());

class RfWarHandler {
    constructor(client, schedule) {
        this.client = client;
        this.schedule = schedule;
    }

    async getStatusChip() {
        const isProduction = process.env.NODE_ENV === 'production'; // Cek environment

        try {
            const browser = await puppeteer.launch({
                headless: true,
                args: isProduction ? ['--no-sandbox', '--disable-setuid-sandbox'] : [] // Auto switch sandbox
            });
            const page = await browser.newPage();
            await page.goto('https://epic.gamecp.net/web_api/?do=satu', { waitUntil: 'domcontentloaded' });

            const content = await page.evaluate(() => {
                const preTag = document.querySelector('pre');
                return preTag ? preTag.innerText : null;
            });

            await browser.close();
            return content ? JSON.parse(content).result : null;
        } catch (error) {
            console.error('Error scraping chip status:', error);
            return null;
        }
    }

    buildPrompt(serverStatus) {
        const { status_game, online_field, chip_a, chip_b, chip_c, win_race, lose_race } = serverStatus;

        let actionPhrase = '';
        if (win_race === 'Bellato') {
            actionPhrase = 'Ambil kesempatan untuk take HR lagi dan tunjukkan dominasi Bellato di medan perang!';
        } else if (chip_b === 0) {
            actionPhrase = 'Bangkit dan menangkan WAR ini demi membalikkan keadaan!';
        } else {
            actionPhrase = 'Kesempatan masih terbuka untuk menangkan WAR ini, jangan sampai Accretia atau Belato mendominasi!';
        }

        const dataSummary = `
Status Server: ${status_game}
Users Online: ${online_field}
Accretia Chip: ${chip_a}%
Bellato Chip: ${chip_b}%
Cora Chip: ${chip_c}%
Pemenang Chip Sebelumnya: ${win_race}
Kalah Chip Sebelumnya: ${lose_race}
`;

        const filledPrompt = this.schedule.ai_prompt
            .replace('{actionPhrase}', actionPhrase)
            .replace('{online_field}', online_field)
            .replace('{win_race}', win_race);

        return `${dataSummary}\n\n${filledPrompt}`;
    }

    async handle() {
        const serverStatus = await this.getStatusChip();
        if (!serverStatus) {
            console.warn('❗ Gagal ambil data server RF.');
            return;
        }

        const prompt = this.buildPrompt(serverStatus);
        const message = await DeepSeekService.generateScheduleMessage(prompt);

        const chat = await this.client.getChatById(this.schedule.chat_id);
        if (this.schedule.chat_id.endsWith('@g.us')) {
            const mentions = chat.participants.map(p => p.id._serialized);
            await chat.sendMessage(message, { mentions });
        } else {
            await this.client.sendMessage(this.schedule.chat_id, message);
        }
    }
}

module.exports = RfWarHandler;
