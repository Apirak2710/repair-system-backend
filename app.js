// 1. กำหนด URL หลักของ Backend บน Render (เปลี่ยนชื่อโดเมนให้ตรงกับ Web Service บน Render ของคุณ)
const BASE_URL = 'https://repair-system-backend.onrender.com/api';

// ==========================================
// ระบบความปลอดภัย (เช็ค Token)
// ==========================================
const token = localStorage.getItem('token');
if (!token) {
    alert('กรุณาเข้าสู่ระบบก่อนใช้งาน');
    window.location.href = 'login.html';
}

// ==========================================
// 1. ฟังก์ชันดึงสถิติตัวเลข Dashboard
// ==========================================
async function fetchStats() {
    const statsContainer = document.getElementById('stats-container');
    if (!statsContainer) return;

    try {
        const response = await fetch(`${BASE_URL}/tickets/stats`);
        if (!response.ok) throw new Error('ไม่สามารถดึงสถิติได้');
        
        const data = await response.json();
        statsContainer.innerHTML = `
            <div style="display: flex; gap: 15px; margin-top: 10px;">
                <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; flex: 1; text-align: center;">
                    <h3 style="margin:0; color:#0d47a1;">รายการทั้งหมด</h3>
                    <p style="font-size: 24px; font-weight: bold; margin: 5px 0 0 0;">${data.total || 0}</p>
                </div>
                <div style="background: #fff3e0; padding: 15px; border-radius: 8px; flex: 1; text-align: center;">
                    <h3 style="margin:0; color:#e65100;">รอดำเนินการ</h3>
                    <p style="font-size: 24px; font-weight: bold; margin: 5px 0 0 0;">${data.pending || 0}</p>
                </div>
                <div style="background: #e8f5e9; padding: 15px; border-radius: 8px; flex: 1; text-align: center;">
                    <h3 style="margin:0; color:#1b5e20;">เสร็จสิ้น</h3>
                    <p style="font-size: 24px; font-weight: bold; margin: 5px 0 0 0;">${data.completed || 0}</p>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Fetch Stats Error:', error);
        statsContainer.innerText = 'ไม่สามารถดึงข้อมูลสถิติได้';
    }
}

// ==========================================
// 2. ฟังก์ชันหลักสำหรับดึงข้อมูลและแสดงผลตาราง
// ==========================================
async function fetchTickets() {
    try {
        const response = await fetch(`${BASE_URL}/tickets`);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'ไม่สามารถดึงข้อมูลได้');
        }
        
        const tickets = await response.json();
        renderTable(tickets);

    } catch (error) {
        console.error('Fetch Tickets Error:', error);
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

    if (!Array.isArray(tickets) || tickets.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">ยังไม่มีรายการแจ้งซ่อม</td></tr>';
        return;
    }

    tickets.forEach(ticket => {
        let statusText = ticket.status;
        let statusColor = 'black';
        
        if (ticket.status === 'pending') { statusText = 'รอดำเนินการ'; statusColor = '#ff9800'; }
        else if (ticket.status === 'in_progress' || ticket.status === 'in-progress') { statusText = 'กำลังซ่อม'; statusColor = '#2196f3'; }
        else if (ticket.status === 'completed' || ticket.status === 'resolved') { statusText = 'ซ่อมเสร็จสิ้น'; statusColor = '#4caf50'; }
        else if (ticket.status === 'cancelled') { statusText = 'ยกเลิก'; statusColor = '#f44336'; }

        const tr = document.createElement('tr');
        if (ticket.id) tr.dataset.id = ticket.id;

        tr.innerHTML = `
            <td data-label="รหัสอุปกรณ์"><b>${ticket.equipment_code || 'ไม่ระบุ'}</b></td>
            <td data-label="สถานะ" style="color: ${statusColor}; font-weight: bold;">${statusText}</td>
            <td data-label="จัดการ"><button class="btn-update" style="display:none;">อัปเดตสถานะ</button><span style="color: #999; font-size: 0.9em;">(ระบบออนไลน์)</span></td>
        `;
        tbody.appendChild(tr);
    });
}

// ==========================================
// 4. ระบบค้นหา (Search)
// ==========================================
function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

const searchInput = document.getElementById('searchInput');
if (searchInput) {
    searchInput.addEventListener('input', debounce((event) => {
        const searchTerm = event.target.value.toLowerCase();
        const rows = document.querySelectorAll('#ticketTable tbody tr');
        
        rows.forEach(row => {
            const eqCode = row.querySelector('td').textContent.toLowerCase();
            if (eqCode.includes(searchTerm)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    }, 300));
}

// ==========================================
// 5. ฟังก์ชันเมื่อผู้ใช้กดปุ่ม "ส่งแจ้งซ่อม"
// ==========================================
const ticketForm = document.getElementById('ticketForm');
if (ticketForm) {
    ticketForm.addEventListener('submit', async (e) => {
        e.preventDefault(); 

        const eqCode = document.getElementById('eqCode').value;
        const issue = document.getElementById('issue').value;
        
        let userId = 1;
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            userId = payload.id;
        } catch (err) {
            console.error('Token parse error:', err);
        }

        try {
            const response = await fetch(`${BASE_URL}/tickets`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    equipment_code: eqCode,
                    issue_description: issue,
                    user_id: userId
                })
            });

            const data = await response.json();

            if (response.ok) {
                alert('✅ ส่งข้อมูลแจ้งซ่อมสำเร็จ ระบบได้รับเรื่องแล้ว!');
                ticketForm.reset(); 
                fetchStats();
                fetchTickets();
            } else {
                alert('❌ เกิดข้อผิดพลาด: ' + data.error);
            }
        } catch (error) {
            console.error(error);
            alert('❌ ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้');
        }
    });
}

// เริ่มต้นทำงานทันทีที่โหลดหน้าเว็บเสร็จ
document.addEventListener('DOMContentLoaded', () => {
    fetchStats();
    fetchTickets();
});