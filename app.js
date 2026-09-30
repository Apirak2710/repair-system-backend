// กำหนดที่อยู่ของ API บน Render (ใช้ลิงก์กลางตัวเดียวกัน)
const API_URL = 'https://repair-system-backend-o7wo.onrender.com/api/tickets';

// ==========================================
// ระบบความปลอดภัย (ดักไม่ให้คนไม่ได้ล็อคอินเข้ามาใช้)
// ==========================================
const token = localStorage.getItem('token');
if (!token) {
    alert('กรุณาเข้าสู่ระบบก่อนใช้งาน');
    window.location.href = 'login.html';
}

// ==========================================
// 1. ฟังก์ชันหลักสำหรับดึงข้อมูลและแสดงผลตาราง
// ==========================================
async function fetchTickets() {
    try {
        const response = await fetch(API_URL);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'ไม่สามารถดึงข้อมูลได้');
        }
        
        const tickets = await response.json();
        
        // เช็คว่าในหน้าเว็บมีตารางแบบไหน (รองรับทั้งหน้าแอดมินและหน้าผู้ใช้ทั่วไป)
        renderTable(tickets);
        
        // อัปเดตข้อความสถิติถ้ามี element นี้อยู่
        const statsContainer = document.getElementById('stats-container');
        if (statsContainer) {
            statsContainer.innerText = `มีรายการแจ้งซ่อมในระบบทั้งหมด ${tickets.length} รายการ`;
        }

    } catch (error) {
        console.error('Error:', error);
        const tbody = document.querySelector('#ticketTable tbody') || document.querySelector('table tbody');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:red;">${error.message}</td></tr>`;
        }
    }
}

// ==========================================
// 2. ฟังก์ชันวาดตาราง HTML (รองรับทุกหน้าจอ)
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
        else if (ticket.status === 'resolved') { statusText = 'ซ่อมเสร็จสิ้น'; statusColor = '#4caf50'; }
        else if (ticket.status === 'cancelled') { statusText = 'ยกเลิก'; statusColor = '#f44336'; }

        const tr = document.createElement('tr');
        if (ticket.id) tr.dataset.id = ticket.id;

        // ตรวจสอบว่ามีปุ่มจัดการหรือเป็นมุมมองผู้ใช้ทั่วไป
        tr.innerHTML = `
            <td data-label="รหัสอุปกรณ์"><b>${ticket.equipment_code || 'ไม่ระบุ'}</b></td>
            <td data-label="สถานะ" style="color: ${statusColor}; font-weight: bold;">${statusText}</td>
            <td data-label="จัดการ"><button class="btn-update" style="display:none;">อัปเดตสถานะ</button><span style="color: #999; font-size: 0.9em;">(ระบบออนไลน์)</span></td>
        `;
        tbody.appendChild(tr);
    });
}

// ==========================================
// 3. ระบบ Debounce สำหรับช่องค้นหา
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
// 4. ระบบ Event Delegation สำหรับปุ่มกดในตาราง
// ==========================================
const ticketTable = document.getElementById('ticketTable');
if (ticketTable) {
    ticketTable.addEventListener('click', (event) => {
        if (event.target.classList.contains('btn-update')) {
            const row = event.target.closest('tr');
            const ticketId = row.dataset.id;
            alert(`คุณกำลังจะจัดการใบแจ้งซ่อมรหัส (Ticket ID): ${ticketId}`);
        }
    });
}

// ==========================================
// ฟังก์ชันเมื่อผู้ใช้กดปุ่ม "ส่งแจ้งซ่อม"
// ==========================================
const ticketForm = document.getElementById('ticketForm');
if (ticketForm) {
    ticketForm.addEventListener('submit', async (e) => {
        e.preventDefault(); 

        const eqCode = document.getElementById('eqCode').value;
        const issue = document.getElementById('issue').value;
        
        let userId = 1; // ค่าสำรองเผื่อกรณีแกะ Token ไม่สำเร็จ
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            userId = payload.id;
        } catch (err) {
            console.error('Token parse error:', err);
        }

        try {
            const response = await fetch(API_URL, {
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
                fetchTickets(); // โหลดตารางใหม่ทันที
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
document.addEventListener('DOMContentLoaded', fetchTickets);