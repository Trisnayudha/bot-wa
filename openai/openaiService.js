const axios = require('axios');

const deepseek = axios.create({
  baseURL: 'https://api.deepseek.com/v1',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer `
  }
});
// Simpan history percakapan per sesi
const conversationHistory = new Map();

class DeepSeekService {
  static async getResponse(question, chatId = 'default', isContinued = false) {
    try {
      // Ambil atau buat history baru
      let messages = conversationHistory.get(chatId) || [
        { 
          role: 'system', 
          content: `Lo adalah assistant gaya Jaksel yang responnya casual banget. 
            Pake campuran Bahasa Indonesia-English, pake slang kek 'ges', 'lur', 'which is', 'literally', 'anjay', 'dongs', 'sih'.
            Contoh: "Halu banget sih lu nanya gituan", atau "Itu mah basic knowledge lur, tinggal google aja yak"
            Jangan terlalu formal, pake singkatan kek 'yg', 'dg', 'kek'.`
        }
      ];

      // Jika command .ai dengan reply
      if (isContinued) {
        messages.push({ role: 'assistant', content: question });
      } else {
        messages.push({ role: 'user', content: question });
      }

      const response = await deepseek.post('/chat/completions', {
        model: 'deepseek-chat',
        messages: messages,
        max_tokens: 1000,
        temperature: 0.3,
        presence_penalty: 0.5,
        frequency_penalty: 0.5
      });

      const aiResponse = this.#addJakselFlavor(response.data.choices[0].message.content.trim());
      
      // Simpan response ke history
      messages.push({ role: 'assistant', content: aiResponse });
      conversationHistory.set(chatId, messages.slice(-6)); // Simpan 3 terakhir percakapan

      return aiResponse;
    } catch (error) {
      console.error('Error ke API DeepSeek:', error.response?.data || error.message);
      return 'Yah error nih, coba lagi deh atau nanya sesuatu yg lebih chill';
    }
  }

  // Helper untuk nambahin gaya Jaksel
  static #addJakselFlavor(text) {
    const jakselPhrases = [
      'lur', 
      'ges',
      'yak',
      'sih',
      'dongs',
      'which is',
      'literally',
      'anjir',
      'btw',
      'kek',
      '...'
    ];
    
    // Tambahin random Jaksel phrase tiap 2-3 kalimat
    return text.split('. ').map((sentence, index) => {
      if (index % 2 === 0 && Math.random() > 0.5) {
        return `${sentence} ${jakselPhrases[Math.floor(Math.random()*jakselPhrases.length)]}`
      }
      return sentence;
    }).join('. ').replace(/\.+/g, '.');
  }
}

module.exports = DeepSeekService;