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
// Middleware: ด่านตรวจ Token ความปลอดภัย
// ==========================================
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // คาดหวังรูปแบบ "Bearer TOKEN"

    if (token == null) return res.status(401).json({ error: 'ไม่พบ Token กรุณาเข้าสู่ระบบ' });

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ error: 'Token ไม่ถูกต้องหรือหมดอายุ' });
        req.user = user;
        next();
    });
};

// ==========================================
// 1. API สมัครสมาชิก (Register) - ไม่ต้องใช้ Token
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
// 2. API เข้าสู่ระบบ (Login) - ไม่ต้องใช้ Token
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
// 3. API สถิติการแจ้งซ่อม (ต้องมี Token)
// ==========================================
const getStatsHandler = async (req, res) => {
    try {
        // ใช้ ` (Backtick) ครอบคำสั่ง SQL และใช้ ' (Single Quote) ครอบข้อความ
        const [total] = await db.execute(`SELECT COUNT(*) as count FROM repairs`);
        const [pending] = await db.execute(`SELECT COUNT(*) as count FROM repairs WHERE status = 'pending'`);
        const [completed] = await db.execute(`SELECT COUNT(*) as count FROM repairs WHERE status = 'resolved' OR status = 'completed'`);
        
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

app.get('/api/tickets/stats', authenticateToken, getStatsHandler);
app.get('/api/dashboard/stats', authenticateToken, getStatsHandler);

// ==========================================
// 4. API ดึงรายการใบแจ้งซ่อมทั้งหมด (ต้องมี Token)
// ==========================================
const getTicketsHandler = async (req, res) => {
    try {
        const sql = `
            SELECT r.id, 
                   COALESCE(r.description, r.problem_desc) AS issue_description, 
                   r.status, 
                   r.created_at, 
                   u.username AS reporter, 
                   COALESCE(r.device_name, r.equipment_code) AS equipment_code 
            FROM repairs r
            LEFT JOIN users u ON r.user_id = u.id
            ORDER BY r.id DESC
        `;
        const [rows] = await db.execute(sql);
        res.json(rows);
    } catch (error) {
        console.error('Fetch Tickets Error:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลใบแจ้งซ่อม' });
    }
};

app.get('/api/tickets', authenticateToken, getTicketsHandler);
app.get('/api/repairs', authenticateToken, getTicketsHandler);

// ==========================================
// 5. API สร้างใบแจ้งซ่อมใหม่ (ต้องมี Token)
// ==========================================
const createTicketHandler = async (req, res) => {
    const { equipment_code, device_name, issue_description, description, user_id = null } = req.body;
    
    const device = equipment_code || device_name;
    const desc = issue_description || description;

    if (!device || !desc) {
        return res.status(400).json({ error: 'กรุณากรอกรหัสอุปกรณ์และรายละเอียดปัญหาให้ครบถ้วน' });
    }

    try {
        const sql = `INSERT INTO repairs (user_id, device_name, description, status) VALUES (?, ?, ?, 'pending')`;
        await db.execute(sql, [user_id, device, desc]);
        
        res.status(201).json({ message: 'บันทึกข้อมูลแจ้งซ่อมสำเร็จ' });
    } catch (error) {
        console.error('Create Ticket Error:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการบันทึกข้อมูลแจ้งซ่อม' });
    }
};

app.post('/api/tickets', authenticateToken, createTicketHandler);
app.post('/api/repairs', authenticateToken, createTicketHandler);

// ==========================================
// 6. API อัปเดตและลบใบแจ้งซ่อม (ต้องมี Token)
// ==========================================
app.put('/api/tickets/:id/status', authenticateToken, async (req, res) => {
    const ticketId = req.params.id; 
    const { status } = req.body;    
    try {
        const sql = `UPDATE repairs SET status = ? WHERE id = ?`;
        await db.execute(sql, [status, ticketId]);
        res.json({ message: 'อัปเดตสถานะสำเร็จ' });
    } catch (error) {
        console.error('Update Status Error:', error);
        res.status(500).json({ error: 'ไม่สามารถอัปเดตฐานข้อมูลได้' });
    }
});

app.delete('/api/tickets/:id', authenticateToken, async (req, res) => {
    try {
        await db.execute('DELETE FROM repairs WHERE id = ?', [req.params.id]);
        res.json({ message: 'ลบข้อมูลสำเร็จ' });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

// ==========================================
// 7. API จัดการผู้ใช้ (ต้องมี Token)
// ==========================================
app.get('/api/users', authenticateToken, async (req, res) => {
    try {
        const [users] = await db.execute('SELECT id, username, role FROM users');
        res.json(users);
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

app.delete('/api/users/:id', authenticateToken, async (req, res) => {
    try {
        await db.execute('DELETE FROM users WHERE id = ?', [req.params.id]);
        res.json({ message: 'ลบผู้ใช้สำเร็จ' });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(` Backend Server รันอยู่บนพอร์ต ${PORT} `);
    console.log(`=========================================`);
});