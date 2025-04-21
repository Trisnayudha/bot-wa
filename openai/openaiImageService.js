const axios = require('axios');
const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

class OpenAIImageService {
    static async generateImage(prompt, chatId) {
        if (!chatId) {
            console.warn('chatId diperlukan untuk validasi limit.');
            return null;
        }

        const isLimited = await this.#isLimitReached(chatId);
        if (isLimited) {
            return '⚠️ Batas harian generate gambar untuk grup ini sudah tercapai (maks 3 per hari). Coba lagi besok ya!';
        }

        try {
            const response = await axios.post(
                'https://api.openai.com/v1/images/generations',
                {
                    prompt: prompt,
                    n: 1,
                    size: '512x512'
                },
                {
                    headers: {
                        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const imageUrl = response.data.data[0].url;
            await this.#incrementUsage(chatId);
            return imageUrl;
        } catch (error) {
            console.error('Gagal generate image:', error.response?.data || error.message);
            return null;
        }
    }

    static async #isLimitReached(chatId) {
        const today = new Date().toISOString().slice(0, 10);
        const conn = await pool.getConnection();

        try {
            const [rows] = await conn.query(
                `SELECT request_count FROM image_generation_logs 
         WHERE chat_id = ? AND request_date = ?`,
                [chatId, today]
            );

            if (rows.length > 0 && rows[0].request_count >= 3) {
                return true;
            }

            return false;
        } catch (error) {
            console.error('Error cek limit gambar:', error.message);
            return true; // fallback: limit otomatis jika error
        } finally {
            conn.release();
        }
    }

    static async #incrementUsage(chatId) {
        const today = new Date().toISOString().slice(0, 10);
        const conn = await pool.getConnection();

        try {
            const [rows] = await conn.query(
                `SELECT * FROM image_generation_logs 
         WHERE chat_id = ? AND request_date = ?`,
                [chatId, today]
            );

            if (rows.length > 0) {
                await conn.query(
                    `UPDATE image_generation_logs 
           SET request_count = request_count + 1 
           WHERE chat_id = ? AND request_date = ?`,
                    [chatId, today]
                );
            } else {
                await conn.query(
                    `INSERT INTO image_generation_logs (chat_id, request_date, request_count) 
           VALUES (?, ?, 1)`,
                    [chatId, today]
                );
            }
        } catch (error) {
            console.error('Gagal update log generate image:', error.message);
        } finally {
            conn.release();
        }
    }
}

module.exports = OpenAIImageService;
