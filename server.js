require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db');
const bcrypt = require('bcrypt'); // นำเข้า bcrypt สำหรับเข้ารหัสผ่าน
const jwt = require('jsonwebtoken'); // นำเข้า jwt สำหรับทำระบบ Token

const app = express();
app.use(cors()); 
app.use(express.json());

const SECRET_KEY = 'my_super_secret_key_123'; // คีย์ลับสำหรับสร้าง Token

// ==========================================
// API สมัครสมาชิก (สำหรับสร้างผู้ใช้ทดสอบ)
// ==========================================
app.post('/api/register', async (req, res) => {
    const { username, password, role } = req.body;
    try {
        // เข้ารหัสผ่านก่อนบันทึกลงฐานข้อมูล (ห้ามเก็บรหัสผ่านเป็นตัวอักษรธรรมดา)
        const hashedPassword = await bcrypt.hash(password, 10);
        const sql = `INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)`;
        await db.execute(sql, [username, hashedPassword, role || 'user']);
        res.status(201).json({ message: 'สร้างผู้ใช้สำเร็จ' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'สร้างผู้ใช้ไม่สำเร็จ อาจมีชื่อนี้แล้ว' });
    }
});

// ==========================================
// API เข้าสู่ระบบ (Login)
// ==========================================
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        // 1. หาชื่อผู้ใช้ในฐานข้อมูล
        const [users] = await db.execute('SELECT * FROM users WHERE username = ?', [username]);
        if (users.length === 0) return res.status(401).json({ error: 'ไม่พบชื่อผู้ใช้งานนี้' });

        const user = users[0];

        // 2. เทียบรหัสผ่านที่กรอกมา กับรหัสที่เข้ารหัสไว้ในฐานข้อมูล
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) return res.status(401).json({ error: 'รหัสผ่านไม่ถูกต้อง' });

        // 3. สร้างตั๋วผ่านทาง (Token)
        const token = jwt.sign({ id: user.id, role: user.role }, SECRET_KEY, { expiresIn: '2h' });

        res.json({ message: 'เข้าสู่ระบบสำเร็จ', token, role: user.role });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดจากเซิร์ฟเวอร์' });
    }
});

// ==========================================
// API สำหรับดึงรายการใบแจ้งซ่อมทั้งหมด (ของเดิม)
// ==========================================
app.get('/api/tickets', async (req, res) => {
    try {
        const sql = `
            SELECT t.id, t.issue_description, t.status, t.created_at, 
                   u.username AS reporter, e.equipment_code 
            FROM repair_tickets t
            LEFT JOIN users u ON t.user_id = u.id
            LEFT JOIN equipments e ON t.equipment_id = e.id
            ORDER BY t.created_at DESC
        `;
        const [rows] = await db.execute(sql);
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดจากเซิร์ฟเวอร์' });
    }
});
// ==========================================
// API สำหรับอัปเดตสถานะใบแจ้งซ่อม (PUT Request)
// ==========================================
app.put('/api/tickets/:id/status', async (req, res) => {
    const ticketId = req.params.id; // ดึง ID จาก URL
    const { status } = req.body;    // ดึงสถานะใหม่ที่ส่งมาจากหน้าเว็บ

    try {
        const sql = `UPDATE repair_tickets SET status = ? WHERE id = ?`;
        await db.execute(sql, [status, ticketId]);
        res.json({ message: 'อัปเดตสถานะสำเร็จ' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'ไม่สามารถอัปเดตฐานข้อมูลได้' });
    }
});
// ==========================================
// API สำหรับสร้างใบแจ้งซ่อมใหม่ (POST Request)
// ==========================================
app.post('/api/tickets', async (req, res) => {
    // รับข้อมูลรหัสอุปกรณ์, ปัญหา, และ ID ของผู้แจ้ง จากหน้าเว็บ
    const { equipment_code, issue_description, user_id } = req.body;
    
    try {
        // 1. เช็คก่อนว่ามีรหัสอุปกรณ์นี้ในฐานข้อมูล (ตาราง equipments) หรือยัง
        let [equipments] = await db.execute('SELECT id FROM equipments WHERE equipment_code = ?', [equipment_code]);
        let equipment_id;
        
        if (equipments.length === 0) {
            // ถ้ายังไม่มีอุปกรณ์นี้ ให้ระบบสร้างประวัติอุปกรณ์ใหม่ให้ชั่วคราว
            const [newEq] = await db.execute('INSERT INTO equipments (equipment_code, name) VALUES (?, ?)', [equipment_code, 'อุปกรณ์ใหม่ (เพิ่มจากหน้าแจ้งซ่อม)']);
            equipment_id = newEq.insertId; // ดึง ID ที่เพิ่งสร้างมาใช้
        } else {
            equipment_id = equipments[0].id; // ถ้ามีอยู่แล้วให้ใช้ ID เดิม
        }

        // 2. บันทึกใบแจ้งซ่อมลงตาราง repair_tickets
        const sql = `INSERT INTO repair_tickets (user_id, equipment_id, issue_description, status) VALUES (?, ?, ?, 'pending')`;
        await db.execute(sql, [user_id, equipment_id, issue_description]);
        
        res.status(201).json({ message: 'บันทึกข้อมูลแจ้งซ่อมสำเร็จ' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' });
    }
});
// 1. API ดึงข้อมูลสถิติ (สำหรับ Dashboard) - GET
app.get('/api/dashboard/stats', async (req, res) => {
    try {
        const [total] = await db.execute('SELECT COUNT(*) as count FROM repair_tickets');
        const [pending] = await db.execute('SELECT COUNT(*) as count FROM repair_tickets WHERE status = "pending"');
        res.json({ total: total[0].count, pending: pending[0].count });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 2. API ลบใบแจ้งซ่อม (Delete Ticket) - DELETE
app.delete('/api/tickets/:id', async (req, res) => {
    try {
        await db.execute('DELETE FROM repair_tickets WHERE id = ?', [req.params.id]);
        res.json({ message: 'ลบข้อมูลสำเร็จ' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 3. API ดึงรายชื่อผู้ใช้ทั้งหมด (Read Users) - GET
app.get('/api/users', async (req, res) => {
    try {
        const [users] = await db.execute('SELECT id, username, role FROM users');
        res.json(users);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 4. API ลบผู้ใช้ (Delete User) - DELETE
app.delete('/api/users/:id', async (req, res) => {
    try {
        await db.execute('DELETE FROM users WHERE id = ?', [req.params.id]);
        res.json({ message: 'ลบผู้ใช้สำเร็จ' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(` Backend Server รันอยู่บนพอร์ต ${PORT} `);
    console.log(` เซิร์ฟเวอร์กำลังทำงาน... ห้ามปิดหน้าต่างนี้ `);
    console.log(`=========================================`);
});