require('dotenv').config();
const mysql = require('mysql2/promise');

async function setupDatabase() {
    try {
        // 1. เชื่อมต่อฐานข้อมูล Aiven
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            port: process.env.DB_PORT,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            ssl: {
                rejectUnauthorized: false
            }
        });

        console.log("เชื่อมต่อฐานข้อมูล Aiven สำเร็จ! กำลังอัปเดตโครงสร้างตาราง...");

        // 2. สร้างตาราง users (ถ้ายังไม่มี)
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                role ENUM('user', 'admin', 'technician') DEFAULT 'user',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log("✅ ตรวจสอบตาราง 'users' เรียบร้อย");

        // 3. สร้างตาราง repairs (ถ้ายังไม่มี)
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS repairs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT,
                device_name VARCHAR(100),
                equipment_code VARCHAR(100),
                description TEXT,
                problem_desc TEXT,
                status VARCHAR(50) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
            )
        `);

        // 4. เพิ่มคอลัมน์ที่จำเป็นเข้าตาราง repairs เผื่อกรณีตารางมีอยู่แล้วแต่คอลัมน์ไม่ครบ
        const alterQueries = [
            `ALTER TABLE repairs ADD COLUMN IF NOT EXISTS device_name VARCHAR(100)`,
            `ALTER TABLE repairs ADD COLUMN IF NOT EXISTS equipment_code VARCHAR(100)`,
            `ALTER TABLE repairs ADD COLUMN IF NOT EXISTS description TEXT`,
            `ALTER TABLE repairs ADD COLUMN IF NOT EXISTS problem_desc TEXT`
        ];

        for (const query of alterQueries) {
            try {
                await connection.execute(query);
            } catch (err) {
                // ข้ามถ้าเป็นเวอร์ชัน MySQL ที่ไม่รองรับ IF NOT EXISTS ใน ALTER
            }
        }

        console.log("✅ อัปเดตคอลัมน์ในตาราง 'repairs' ครบถ้วนแล้ว");
        console.log("🎉 ติดตั้งฐานข้อมูลเสร็จสมบูรณ์!");
        
        // ปิดการเชื่อมต่อ
        await connection.end();
        process.exit(0);

    } catch (error) {
        console.error("❌ เกิดข้อผิดพลาด:", error);
        process.exit(1);
    }
}

setupDatabase();