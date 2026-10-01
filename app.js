const API_URL = 'https://repair-system-backend-o7wo.onrender.com/api/tickets';
const STATS_URL = 'https://repair-system-backend-o7wo.onrender.com/api/dashboard/stats';

// ==========================================
// ระบบความปลอดภัย (เช็ค Token)
// ==========================================
const token = localStorage.getItem('token');
if (!token) {
    alert('กรุณาเข้าสู่ระบบก่อนใช้งาน');
    window.location.href = 'login.html';
}

// ==========================================
// 1. ฟังก์ชันดึงข้อมูลสถิติ
// ==========================================
async function loadStats() {
    try {
        const res = await fetch(STATS_URL, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}` 
            }
        });
        
        if (!res.ok) throw new Error('ดึงข้อมูลสถิติไม่ได้');
        const data = await res.json();
        
        const statsContainer = document.getElementById('stats-container');
        if (statsContainer) {
            statsContainer.innerHTML = `
                <div style="display: flex; gap: 15px; flex-wrap: wrap;">
                    <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; flex: 1; text-align: center;">
                        <h3 style="margin: 0; color: #1565c0;">${data.total}</h3>
                        <p style="margin: 5px 0 0; font-size: 14px;">แจ้งซ่อมทั้งหมด</p>
                    </div>
                    <div style="background: #fff3e0; padding: 15px; border-radius: 8px; flex: 1; text-align: center;">
                        <h3 style="margin: 0; color: #e65100;">${data.pending}</h3>
                        <p style="margin: 5px 0 0; font-size: 14px;">รอดำเนินการ</p>
                    </div>
                    <div style="background: #e8f5e9; padding: 15px; border-radius: 8px; flex: 1; text-align: center;">
                        <h3 style="margin: 0; color: #2e7d32;">${data.completed}</h3>
                        <p style="margin: 5px 0 0; font-size: 14px;">ซ่อมเสร็จสิ้น</p>
                    </div>
                </div>
            `;
        }
    } catch (err) {
        console.error('Stats Error:', err);
        const statsContainer = document.getElementById('stats-container');
        if (statsContainer) statsContainer.innerText = `เกิดข้อผิดพลาดในการโหลดสถิติ`;
    }
}

// ==========================================
// 2. ฟังก์ชันดึงข้อมูลตารางแจ้งซ่อม
// ==========================================
async function fetchTickets() {
    try {
        const response = await fetch(API_URL, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'เกิดข้อผิดพลาดจากเซิร์ฟเวอร์');
        }
        
        const tickets = await response.json();
        renderTable(tickets);

    } catch (error) {
        console.error('Error fetching tickets:', error);
        const tbody = document.querySelector('#ticketTable tbody') || document.querySelector('table tbody');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:red;">${error.message}</td></tr>`;
        }
    }
}

// ==========================================
// 3. ฟังก์ชันวาดตาราง HTML
// ==========================================
function renderTable(tickets) {
    const tbody = document.querySelector('#ticketTable tbody') || document.querySelector('table tbody');
    if (!tbody) return;

    tbody.innerHTML = ''; 

    if (tickets.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">ยังไม่มีรายการแจ้งซ่อม</td></tr>';
        return;
    }

    tickets.forEach(ticket => {
        let statusText = ticket.status;
        let statusColor = 'black';
        
        if (ticket.status === 'pending') { statusText = 'รอดำเนินการ'; statusColor = '#ff9800'; }
        else if (ticket.status === 'in_progress') { statusText = 'กำลังซ่อม'; statusColor = '#2196f3'; }
        else if (ticket.status === 'resolved' || ticket.status === 'completed') { statusText = 'ซ่อมเสร็จสิ้น'; statusColor = '#4caf50'; }
        else if (ticket.status === 'cancelled') { statusText = 'ยกเลิก'; statusColor = '#f44336'; }

        const tr = document.createElement('tr');
        if (ticket.id) tr.dataset.id = ticket.id;

        tr.innerHTML = `
            <td data-label="รหัสอุปกรณ์"><b>${ticket.equipment_code || 'ไม่ระบุ'}</b></td>
            <td data-label="สถานะ" style="color: ${statusColor}; font-weight: bold;">${statusText}</td>
            <td data-label="จัดการ"><span style="color: #999; font-size: 0.9em;">(ดูสถานะออนไลน์)</span></td>
        `;
        tbody.appendChild(tr);
    });
}

// ==========================================
// 4. ฟังก์ชันส่งฟอร์มแจ้งซ่อม
// ==========================================
const ticketForm = document.getElementById('ticketForm');
if (ticketForm) {
    ticketForm.addEventListener('submit', async (e) => {
        e.preventDefault(); 

        const eqCode = document.getElementById('eqCode').value;
        const issue = document.getElementById('issue').value;
        
        let userId = null; 
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            userId = payload.id;
        } catch (err) {
            console.error('Token parse error:', err);
        }

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({
                    equipment_code: eqCode,
                    issue_description: issue,
                    user_id: userId
                })
            });

            const data = await response.json();

            if (response.ok) {
                alert('✅ ส่งข้อมูลแจ้งซ่อมสำเร็จ!');
                ticketForm.reset(); 
                fetchTickets(); // โหลดตารางใหม่
                loadStats(); // อัปเดตสถิติใหม่
            } else {
                alert('❌ เกิดข้อผิดพลาด: ' + data.error);
            }
        } catch (error) {
            console.error(error);
            alert('❌ ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้');
        }
    });
}

// เริ่มต้นทำงานดึงข้อมูลทั้งคู่เมื่อเปิดหน้าเว็บ
document.addEventListener('DOMContentLoaded', () => {
    fetchTickets();
    loadStats();
});