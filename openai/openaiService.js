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

  static async getResponse(question, chatId, isReply, isJaksel = false) {
    try {
      let messages = await this.#getHistory(chatId);

      // Tambahkan pesan user atau assistant
      if (isReply) {
        messages.push({ role: 'user', content: `Ini balasan dari pesan sebelumnya: "${question}"` });
      } else {
        messages.push({ role: 'user', content: question });
      }
      await this.#saveHistory(chatId, 'user', question);

      // Kirim request ke API DeepSeek
      const response = await deepseek.post('/chat/completions', {
        model: 'deepseek-chat',
        messages: messages,
        max_tokens: 1000,
        temperature: 0.3,
        presence_penalty: 0.5,
        frequency_penalty: 0.5
      });

      // Ambil respons dari DeepSeek
      let aiResponse = response.data.choices[0].message.content.trim();

      // Jika isJaksel true, tambahkan gaya Jaksel ke respons
      if (isJaksel) {
        aiResponse = this.#addJakselFlavor(aiResponse);
      }

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
      'lur', 'ges', 'yak', 'sih', 'dongs', 'which is', 'literally', 'anjir', 'btw', 'kek',
      '...', 'bro', 'sis', 'banget', 'gimana sih', 'ya kan', 'tuh', 'pasti', 'gokil', 'asik', 'cuy',
      'mas', 'mba', 'gaskeun', 'santai aja', 'kerja keras', 'mantap', 'fix', 'ayo', 'yuk', 'semangat',
      'enak banget', 'gimana nih', 'udah lah', 'seru banget', 'capek deh', 'bener sih', 'nggak sih',
      'kerja keras banget', 'selalu berhasil', 'mantep banget', 'fix banget', 'bener banget', 'eh serius deh',
      'semangat terus', 'jangan lupa', 'yoi', 'oke lah', 'gas terus', 'jangan sampe gagal', 'udah gitu aja',
      'pokoknya gitu', 'gaul banget', 'asli', 'keren banget sih', 'pasti banget', 'gitu dong', 'jadi deh', 'masuk akal'
    ];

    return text.split('. ').map((sentence, index) => {
      // Randomly insert Jaksel phrase into every alternate sentence
      if (index % 2 === 0 && Math.random() > 0.5) {
        return `${sentence} ${jakselPhrases[Math.floor(Math.random() * jakselPhrases.length)]}`;
      }
      return sentence;
    }).join('. ').replace(/\.+/g, '.');
  }

}

module.exports = DeepSeekService;