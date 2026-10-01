// URL ของ Backend บน Render
const BASE_URL = 'https://repair-system-backend-o7wo.onrender.com/api';

// ดึง Token จากระบบ
const token = localStorage.getItem('token');

// ==========================================
// 1. ตรวจสอบสิทธิ์การเข้าใช้งาน
// ==========================================
if (!token) {
    alert('กรุณาเข้าสู่ระบบก่อนใช้งาน');
    window.location.href = 'login.html';
}

// ตั้งค่า Headers สำหรับการส่ง Request (เพิ่ม Token ยืนยันตัวตน)
const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
};

// ==========================================
// 2. ฟังก์ชันดึงข้อมูลสถิติ (Dashboard Stats)
// ==========================================
async function fetchStats() {
    try {
        const response = await fetch(`${BASE_URL}/dashboard/stats`, { 
            method: 'GET', 
            headers: authHeaders 
        });
        
        if (!response.ok) throw new Error('ไม่สามารถดึงข้อมูลสถิติได้');
        
        const data = await response.json();
        
        // อัปเดตตัวเลขลงในหน้าเว็บ (ค้นหาจากข้อความในกล่อง)
        const statsBoxes = document.querySelectorAll('.stat-box, .box, div'); // ปรับให้ครอบคลุม
        statsBoxes.forEach(box => {
            if (box.innerText.includes('แจ้งซ่อมทั้งหมด')) {
                box.innerHTML = `<b>แจ้งซ่อมทั้งหมด:</b> ${data.total || 0} รายการ`;
            }
            if (box.innerText.includes('รอดำเนินการ')) {
                box.innerHTML = `<b>รอดำเนินการ:</b> ${data.pending || 0} รายการ`;
            }
        });
        
    } catch (error) {
        console.error('Stats Error:', error);
    }
}

// ==========================================
// 3. ฟังก์ชันดึงรายการแจ้งซ่อมทั้งหมด
// ==========================================
async function fetchAdminTickets() {
    const tbody = document.querySelector('table tbody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">กำลังโหลดข้อมูล...</td></tr>';

    try {
        const response = await fetch(`${BASE_URL}/tickets`, { 
            method: 'GET', 
            headers: authHeaders 
        });
        
        if (!response.ok) throw new Error('ไม่มีสิทธิ์ในการดึงข้อมูลหรือเซิร์ฟเวอร์มีปัญหา');
        
        const tickets = await response.json();
        renderAdminTable(tickets);
    } catch (error) {
        console.error('Tickets Error:', error);
        if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">${error.message}</td></tr>`;
    }
}

// ==========================================
// 4. ฟังก์ชันวาดตาราง และสร้างปุ่มจัดการ
// ==========================================
function renderAdminTable(tickets) {
    const tbody = document.querySelector('table tbody');
    if (!tbody) return;
    
    tbody.innerHTML = ''; 

    if (tickets.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">ยังไม่มีรายการแจ้งซ่อม</td></tr>';
        return;
    }

    tickets.forEach(ticket => {
        // จัดการวันที่ให้อ่านง่าย
        const dateObj = new Date(ticket.created_at);
        const formattedDate = dateObj.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><b>${ticket.equipment_code || ticket.device_name || '-'}</b></td>
            <td>${ticket.reporter || 'ผู้ใช้ทั่วไป'}</td>
            <td>${ticket.issue_description || ticket.description || '-'}</td>
            <td>${formattedDate}</td>
            <td>
                <select class="status-dropdown" onchange="updateTicketStatus(${ticket.id}, this.value)" style="padding: 5px; border-radius: 4px;">
                    <option value="pending" ${ticket.status === 'pending' ? 'selected' : ''}>รอดำเนินการ</option>
                    <option value="in-progress" ${(ticket.status === 'in-progress' || ticket.status === 'in_progress') ? 'selected' : ''}>กำลังซ่อม</option>
                    <option value="completed" ${(ticket.status === 'completed' || ticket.status === 'resolved') ? 'selected' : ''}>เสร็จสิ้น</option>
                    <option value="cancelled" ${ticket.status === 'cancelled' ? 'selected' : ''}>ยกเลิก</option>
                </select>
            </td>
            <td>
                <button onclick="deleteTicket(${ticket.id})" style="background: #f44336; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;">ลบ</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// ==========================================
// 5. ฟังก์ชันอัปเดตสถานะ
// ==========================================
window.updateTicketStatus = async function(id, newStatus) {
    try {
        const response = await fetch(`${BASE_URL}/tickets/${id}/status`, {
            method: 'PUT',
            headers: authHeaders,
            body: JSON.stringify({ status: newStatus })
        });
        
        if (response.ok) {
            alert('อัปเดตสถานะสำเร็จ');
            fetchStats(); // อัปเดตสถิติหลังเปลี่ยนสถานะ
        } else {
            alert('ไม่สามารถอัปเดตสถานะได้');
        }
    } catch (error) {
        console.error(error);
        alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    }
};

// ==========================================
// 6. ฟังก์ชันลบรายการแจ้งซ่อม
// ==========================================
window.deleteTicket = async function(id) {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบรายการแจ้งซ่อมนี้?')) return;

    try {
        const response = await fetch(`${BASE_URL}/tickets/${id}`, {
            method: 'DELETE',
            headers: authHeaders
        });
        
        if (response.ok) {
            alert('ลบรายการสำเร็จ');
            fetchAdminTickets(); // โหลดตารางใหม่
            fetchStats(); // อัปเดตสถิติใหม่
        } else {
            alert('ไม่สามารถลบรายการได้');
        }
    } catch (error) {
        console.error(error);
    }
};

// ==========================================
// 7. ฟังก์ชันค้นหา
// ==========================================
const searchInput = document.querySelector('input[placeholder*="ค้นหา"]');
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const rows = document.querySelectorAll('table tbody tr');
        rows.forEach(row => {
            const text = row.innerText.toLowerCase();
            row.style.display = text.includes(term) ? '' : 'none';
        });
    });
}

// ==========================================
// เริ่มทำงานเมื่อเปิดหน้าเว็บ
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    fetchStats();
    fetchAdminTickets();
});