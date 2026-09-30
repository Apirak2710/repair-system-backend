require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors()); 
app.use(express.json());

const SECRET_KEY = process.env.JWT_SECRET || 'my_super_secret_key_123';

// ==========================================
// 1. API สมัครสมาชิก (Register)
// ==========================================
app.post('/api/register', async (req, res) => {
    const { username, password, role } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const sql = `INSERT INTO users (username, password, role) VALUES (?, ?, ?)`;
        await db.execute(sql, [username, hashedPassword, role || 'user']);
        res.status(201).json({ message: 'สร้างผู้ใช้สำเร็จ' });
    } catch (error) {
        console.error('Register Error:', error);
        res.status(500).json({ error: 'สร้างผู้ใช้ไม่สำเร็จ อาจมีชื่อนี้แล้วในระบบ' });
    }
});

// ==========================================
// 2. API เข้าสู่ระบบ (Login)
// ==========================================
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const [users] = await db.execute('SELECT * FROM users WHERE username = ?', [username]);
        if (users.length === 0) return res.status(401).json({ error: 'ไม่พบชื่อผู้ใช้งานนี้' });

        const user = users[0];
        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).json({ error: 'รหัสผ่านไม่ถูกต้อง' });

        const token = jwt.sign({ id: user.id, role: user.role, username: user.username }, SECRET_KEY, { expiresIn: '1d' });

        res.json({ message: 'เข้าสู่ระบบสำเร็จ', token, role: user.role, user: { id: user.id, username: user.username, role: user.role } });
    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดจากเซิร์ฟเวอร์' });
    }
});

// ==========================================
// 3. API สถิติการแจ้งซ่อม (ดึงสถิติตัวเลข Dashboard)
// (รองรับทั้ง /api/tickets/stats และ /api/dashboard/stats)
// ==========================================
const getStatsHandler = async (req, res) => {
    try {
        const [total] = await db.execute('SELECT COUNT(*) as count FROM repair_tickets');
        const [pending] = await db.execute('SELECT COUNT(*) as count FROM repair_tickets WHERE status = "pending"');
        const [completed] = await db.execute('SELECT COUNT(*) as count FROM repair_tickets WHERE status = "completed"');
        
        res.json({ 
            total: total[0].count || 0, 
            pending: pending[0].count || 0,
            completed: completed[0].count || 0 
        });
    } catch (err) { 
        console.error('Stats Error:', err);
        res.status(500).json({ error: err.message }); 
    }
};

app.get('/api/tickets/stats', getStatsHandler);
app.get('/api/dashboard/stats', getStatsHandler);

// ==========================================
// 4. API ดึงรายการใบแจ้งซ่อมทั้งหมด
// (รองรับทั้ง /api/tickets และ /api/repairs)
// ==========================================
const getTicketsHandler = async (req, res) => {
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
        console.error('Fetch Tickets Error:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลใบแจ้งซ่อม' });
    }
};

app.get('/api/tickets', getTicketsHandler);
app.get('/api/repairs', getTicketsHandler);

// ==========================================
// 5. API สร้างใบแจ้งซ่อมใหม่ (POST Request)
// ==========================================
const createTicketHandler = async (req, res) => {
    const { equipment_code, issue_description, user_id = null } = req.body;
    
    if (!equipment_code || !issue_description) {
        return res.status(400).json({ error: 'กรุณากรอกรหัสอุปกรณ์และรายละเอียดปัญหาให้ครบถ้วน' });
    }

    try {
        let [equipments] = await db.execute('SELECT id FROM equipments WHERE equipment_code = ?', [equipment_code]);
        let equipment_id;
        
        if (equipments.length === 0) {
            const [newEq] = await db.execute('INSERT INTO equipments (equipment_code, name) VALUES (?, ?)', [equipment_code, 'อุปกรณ์ใหม่ (เพิ่มจากหน้าแจ้งซ่อม)']);
            equipment_id = newEq.insertId; 
        } else {
            equipment_id = equipments[0].id; 
        }

        const sql = `INSERT INTO repair_tickets (user_id, equipment_id, issue_description, status) VALUES (?, ?, ?, 'pending')`;
        await db.execute(sql, [user_id, equipment_id, issue_description]);
        
        res.status(201).json({ message: 'บันทึกข้อมูลแจ้งซ่อมสำเร็จ' });
    } catch (error) {
        console.error('Create Ticket Error:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการบันทึกข้อมูลแจ้งซ่อม' });
    }
};

app.post('/api/tickets', createTicketHandler);
app.post('/api/repairs', createTicketHandler);

// ==========================================
// 6. API อัปเดตสถานะใบแจ้งซ่อม (PUT Request)
// ==========================================
app.put('/api/tickets/:id/status', async (req, res) => {
    const ticketId = req.params.id; 
    const { status } = req.body;    

    try {
        const sql = `UPDATE repair_tickets SET status = ? WHERE id = ?`;
        await db.execute(sql, [status, ticketId]);
        res.json({ message: 'อัปเดตสถานะสำเร็จ' });
    } catch (error) {
        console.error('Update Status Error:', error);
        res.status(500).json({ error: 'ไม่สามารถอัปเดตฐานข้อมูลได้' });
    }
});

// ==========================================
// 7. API ลบใบแจ้งซ่อม (DELETE Request)
// ==========================================
app.delete('/api/tickets/:id', async (req, res) => {
    try {
        await db.execute('DELETE FROM repair_tickets WHERE id = ?', [req.params.id]);
        res.json({ message: 'ลบข้อมูลสำเร็จ' });
    } catch (err) { 
        console.error('Delete Ticket Error:', err);
        res.status(500).json({ error: err.message }); 
    }
});

// ==========================================
// 8. API จัดการผู้ใช้ (Users Management)
// ==========================================
app.get('/api/users', async (req, res) => {
    try {
        const [users] = await db.execute('SELECT id, username, role FROM users');
        res.json(users);
    } catch (err) { 
        console.error('Get Users Error:', err);
        res.status(500).json({ error: err.message }); 
    }
});

app.delete('/api/users/:id', async (req, res) => {
    try {
        await db.execute('DELETE FROM users WHERE id = ?', [req.params.id]);
        res.json({ message: 'ลบผู้ใช้สำเร็จ' });
    } catch (err) { 
        console.error('Delete User Error:', err);
        res.status(500).json({ error: err.message }); 
    }
});

// ==========================================
// Start Server
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(` Backend Server รันอยู่บนพอร์ต ${PORT} `);
    console.log(`=========================================`);
});