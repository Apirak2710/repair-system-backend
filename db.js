require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,    // 👈 เพิ่มบรรทัดนี้! สำคัญมาก ไม่งั้นมันจะหาทางเข้าฐานข้อมูลไม่เจอ
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: {                        // 👈 เพิ่ม Block นี้! ฐานข้อมูลบนคลาวด์บังคับให้เชื่อมต่อแบบปลอดภัย
        rejectUnauthorized: false
    }
});

module.exports = pool;