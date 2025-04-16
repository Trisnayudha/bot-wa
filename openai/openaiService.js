const axios = require('axios');
const mysql = require('mysql2/promise');
require('dotenv').config();

// Konfigurasi database
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const deepseek = axios.create({
  baseURL: 'https://api.deepseek.com/v1',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
  }
});

class DeepSeekService {
  static async #getHistory(chatId) {
    let connection;
    try {
      connection = await pool.getConnection();
      // Ambil 6 pesan terakhir
      const [rows] = await connection.query(
        `SELECT role, message 
         FROM chat_histories 
         WHERE chat_id = ? 
         ORDER BY created_at DESC 
         LIMIT 6`,
        [chatId]
      );

      // Jika tidak ada history, return system message
      if (rows.length === 0) {
        return [this.#getSystemMessage()];
      }

      // Reconstruct messages + system message
      return [
        this.#getSystemMessage(),
        ...rows.reverse().map(row => ({
          role: row.role,
          content: row.message
        }))
      ];
    } catch (error) {
      console.error('Database error:', error);
      return [this.#getSystemMessage()];
    } finally {
      if (connection) connection.release();
    }
  }

  static async #saveHistory(chatId, role, message) {
    let connection;
    try {
      connection = await pool.getConnection();
      
      // Insert new message
      await connection.query(
        `INSERT INTO chat_histories (chat_id, role, message)
         VALUES (?, ?, ?)`,
        [chatId, role, message]
      );

      // Hapus pesan lama jika lebih dari 6
      await connection.query(
        `DELETE FROM chat_histories 
         WHERE chat_id = ? 
         AND id NOT IN (
           SELECT id 
           FROM (
             SELECT id 
             FROM chat_histories 
             WHERE chat_id = ? 
             ORDER BY created_at DESC 
             LIMIT 6
           ) AS temp
         )`,
        [chatId, chatId]
      );
    } catch (error) {
      console.error('Gagal menyimpan history:', error);
    } finally {
      if (connection) connection.release();
    }
  }

  static #getSystemMessage() {
    return {
      role: 'system',
      content: `Lo adalah assistant gaya Jaksel...` // System message lengkap
    };
  }

  static async getResponse(question, chatId = 'default', isContinued = false) {
    try {
      let messages = await this.#getHistory(chatId);
      // Tambahkan pesan user/assistant
      if (isContinued) {
        messages.push({ role: 'assistant', content: question });
        await this.#saveHistory(chatId, 'assistant', question);
      } else {
        messages.push({ role: 'user', content: question });
        await this.#saveHistory(chatId, 'user', question);
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
      
      // Simpan response AI
      messages.push({ role: 'assistant', content: aiResponse });
      await this.#saveHistory(chatId, 'assistant', aiResponse);

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
      '...', 
      'bro', 
      'sis', 
      'banget', 
      'gimana sih', 
      'ya kan', 
      'tuh', 
      'pasti', 
      'gokil', 
      'asik', 
      'cuy', 
      'seru sih', 
      'nggak sih', 
      'kepo', 
      'parah', 
      'pokoknya', 
      'nggak banget', 
      'hype banget', 
      'biasa aja', 
      'lebih keren', 
      'udah deh', 
      'cinta banget', 
      'lumayan', 
      'beneran', 
      'capek deh', 
      'fix', 
      'habis itu', 
      'gini nih', 
      'kerja keras', 
      'asli', 
      'keknya', 
      'bener sih', 
      'nggak ada lawan', 
      'jangan sampe', 
      'eh tapi', 
      'diem-diem', 
      'serius', 
      'gaul', 
      'baper', 
      'santai aja', 
      'ih iyah', 
      'ah masa sih', 
      'gimana ya', 
      'mantep', 
      'sama aja', 
      'terserah', 
      'oke lah', 
      'wah gitu ya', 
      'eh serius deh', 
      'yoi', 
      'lets go', 
      'anjir, gila', 
      'gitu aja kok repot', 
      'asik banget', 
      'gokil deh', 
      'seru banget', 
      'makasih ya', 
      'biasa aja lah', 
      'pas banget', 
      'udah tau', 
      'gapapa deh', 
      'eh lu tau ga', 
      'udah gitu aja', 
      'gimana kalo', 
      'seru banget ga sih', 
      'nggak nyangka deh', 
      'nggak ada habisnya', 
      'mantul', 
      'gaul banget', 
      'semangat terus', 
      'aneh sih', 
      'yah, kalo gitu sih', 
      'keren banget sih', 
      'kalo udah gitu', 
      'biasa banget', 
      'aduh gue sih', 
      'jangan gitu dong', 
      'cuma gitu doang', 
      'seru banget ya', 
      'enak banget sih', 
      'tapi bener loh', 
      'eh, katanya', 
      'gak pernah se-hype ini', 
      'jadi inget deh', 
      'ga ada bandingannya', 
      'dulu gue banget sih', 
      'wah pas banget', 
      'yaudah deh', 
      'bukan masalah sih', 
      'terus terang', 
      'aduh, capek banget', 
      'jadi pengen sih', 
      'kayaknya deh', 
      'sama gue juga sih', 
      'nanti gue kasih tau', 
      'eh pas banget', 
      'anjir sih', 
      'gak ngerti gue', 
      'yuk, yuk', 
      'bener banget sih', 
      'percaya deh', 
      'yap', 
      'gue bisa jadi', 
      'ya gitu deh', 
      'kayaknya sih', 
      'nanggung banget', 
      'seru deh', 
      'nyantai aja', 
      'ngomong-ngomong', 
      'kepo banget sih', 
      'ya gitu', 
      'bukan cuma itu', 
      'emang sih', 
      'santai, santai', 
      'ada apa sih', 
      'kalo gitu gini deh', 
      'cuma biar lebih keren', 
      'ngetes aja', 
      'deh gitu', 
      'nggak gitu loh', 
      'iya banget', 
      'wah keren banget', 
      'eh beneran', 
      'cuy, itu loh', 
      'di rumah gue', 
      'percaya ga percaya', 
      'ah, biasa aja', 
      'gue juga sih', 
      'gila ya', 
      'oke deh', 
      'sama banget deh', 
      'bisa aja', 
      'makasih banyak', 
      'parah banget', 
      'pas banget loh', 
      'seru banget ya', 
      'gokil banget sih', 
      'yaudah lah', 
      'tapi kalo', 
      'gitu banget', 
      'mungkin kali ya', 
      'soalnya sih', 
      'lebih bagus sih', 
      'bisa banget', 
      'seru banget kan', 
      'lebih seru', 
      'pokoknya deh', 
      'ya lu deh', 
      'ga suka deh', 
      'kayak gitu', 
      'gini deh', 
      'gitu deh', 
      'ntar dulu', 
      'gila banget', 
      'kebanyakan sih', 
      'enggak deh', 
      'ini beneran', 
      'seru kan', 
      'ih lucu banget', 
      'nggak ada yang ngalahin', 
      'oke gue setuju', 
      'bener sih', 
      'masih ada sih', 
      'gue pasti bisa', 
      'keren banget banget', 
      'pasti banget', 
      'jadi penasaran', 
      'sama kayak gue', 
      'semoga berhasil', 
      'ini baru seru', 
      'seru banget dah', 
      'di luar dugaan', 
      'seru banget banget', 
      'mantep banget', 
      'gak salah sih', 
      'gimana kalo kita', 
      'udah siap', 
      'emang sih', 
      'gue penasaran banget', 
      'emang udah gitu', 
      'seru banget coy'
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