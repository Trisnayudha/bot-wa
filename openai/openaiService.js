const { OpenAI } = require("openai");

// Konfigurasi OpenAI
const openai = new OpenAI({
    apiKey: '',
});

class OpenAIService {
    static async getResponse(question) {
        try {
            // Panggil OpenAI API untuk mendapatkan respons
            const completion = await openai.chat.completions.create({
                model: 'gpt-3.5-turbo', // Gunakan model GPT yang direkomendasikan
                messages: [
                    { role: 'system', content: 'You are a helpful assistant.' },
                    { role: 'user', content: question },
                ],
                max_tokens: 100, // Batasi jumlah token untuk respons
            });

            return completion.choices[0].message.content.trim();
        } catch (error) {
            console.error('Error saat menghubungkan ke OpenAI:', error.message);
            return 'Maaf, terjadi kesalahan saat memproses pertanyaan Anda.';
        }
    }
}

module.exports = OpenAIService;
