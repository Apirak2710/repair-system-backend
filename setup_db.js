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

        console.log("เชื่อมต่อฐานข้อมูล Aiven สำเร็จ! กำลังสร้างตาราง...");

        // 2. สร้างตาราง users (สำหรับเก็บข้อมูลผู้ใช้งานและช่าง)
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                role ENUM('user', 'admin', 'technician') DEFAULT 'user',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log("✅ สร้างตาราง 'users' สำเร็จ");

        // 3. สร้างตาราง repairs (สำหรับเก็บข้อมูลการแจ้งซ่อม)
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS repairs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT,
                device_name VARCHAR(100) NOT NULL,
                problem_desc TEXT NOT NULL,
                status ENUM('pending', 'in_progress', 'completed', 'cancelled') DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
            )
        `);
        console.log("✅ สร้างตาราง 'repairs' สำเร็จ");

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