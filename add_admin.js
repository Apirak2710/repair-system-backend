require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt'); 

async function addAdmin() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            port: process.env.DB_PORT,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            ssl: { rejectUnauthorized: false }
        });

        // 📝 ตั้งค่าผู้ใช้ที่ต้องการแก้ไข
        const username = 'apirak.th@rmuti.ac.th';
        const plainPassword = 'At12345678'; // <-- แก้รหัสผ่านที่ต้องการตรงนี้
        const role = 'admin';

        // 🔐 เข้ารหัสผ่านใหม่
        const hashedPassword = await bcrypt.hash(plainPassword, 10);

        // 🔄 ใช้คำสั่ง UPDATE เพื่อแก้ไขรหัสผ่านของคนเดิม แทนการเพิ่มใหม่
        await connection.execute(
            'UPDATE users SET password = ?, role = ? WHERE username = ?',
            [hashedPassword, role, username]
        );

        console.log('✅ อัปเดตรหัสผ่านแอดมิน (เป็นแบบเข้ารหัส) สำเร็จ!');
        process.exit(0);
    } catch (error) {
        console.error('❌ เกิดข้อผิดพลาด:', error);
        process.exit(1);
    }
}

addAdmin();