// 1. ตรวจสอบความปลอดภัย (Security Check) ว่าเป็น Admin จริงไหม
const userRole = localStorage.getItem('role');
const token = localStorage.getItem('token');

// ถ้าไม่มีตั๋ว หรือไม่ใช่แอดมิน ให้เตะกลับไปหน้าล็อคอินทันที
if (!token || (userRole !== 'admin' && userRole !== 'technician')) {
    alert('คุณไม่มีสิทธิ์เข้าถึงหน้านี้!');
    window.location.href = 'login.html';
}

// 2. ฟังก์ชันดึงข้อมูลมาแสดงในตาราง
async function fetchAdminTickets() {
    try {
        const response = await fetch('https://repair-system-backend-o7wo.onrender.com/api/tickets');
        if (!response.ok) throw new Error('ดึงข้อมูลไม่ได้');
        
        const tickets = await response.json();
        const tbody = document.querySelector('#adminTicketTable tbody');
        tbody.innerHTML = ''; 

        if (tickets.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">ไม่มีรายการแจ้งซ่อม</td></tr>';
            return;
        }

        tickets.forEach(ticket => {
            const date = new Date(ticket.created_at).toLocaleString('th-TH');
            const tr = document.createElement('tr');
            
            // สร้าง Dropdown เลือกสถานะ (ดึงค่าสถานะเดิมจาก Database มาแสดงเป็นค่าเริ่มต้น)
            tr.innerHTML = `
                <td data-label="รหัสอุปกรณ์"><b>${ticket.equipment_code || 'ไม่ระบุ'}</b></td>
                <td data-label="ผู้แจ้ง">${ticket.reporter || 'ไม่ระบุ'}</td>
                <td data-label="ปัญหาที่พบ">${ticket.issue_description}</td>
                <td data-label="วันที่แจ้ง">${date}</td>
                <td data-label="อัปเดตสถานะ">
                    <select class="status-select" id="status-${ticket.id}">
                        <option value="pending" ${ticket.status === 'pending' ? 'selected' : ''}>รอดำเนินการ</option>
                        <option value="in_progress" ${ticket.status === 'in_progress' ? 'selected' : ''}>กำลังซ่อม</option>
                        <option value="resolved" ${ticket.status === 'resolved' ? 'selected' : ''}>ซ่อมเสร็จสิ้น</option>
                        <option value="cancelled" ${ticket.status === 'cancelled' ? 'selected' : ''}>ยกเลิก</option>
                    </select>
                </td>
                <td data-label="จัดการ">
                    <button class="save-btn" onclick="updateTicketStatus(${ticket.id})">บันทึกสถานะ</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error(error);
    }
}

// 3. ฟังก์ชันส่งข้อมูลการอัปเดตสถานะไปที่เซิร์ฟเวอร์
async function updateTicketStatus(ticketId) {
    // ดึงค่าสถานะจาก Dropdown ที่เราเพิ่งเลือก
    const newStatus = document.getElementById(`status-${ticketId}`).value;

    try {
        const response = await fetch(`https://repair-system-backend-o7wo.onrender.com/api/tickets/${ticketId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });

        if (response.ok) {
            alert('อัปเดตสถานะเรียบร้อยแล้ว!');
            fetchAdminTickets(); // รีเฟรชตารางใหม่
        } else {
            alert('เกิดข้อผิดพลาดในการบันทึก');
        }
    } catch (error) {
        console.error(error);
        alert('ไม่สามารถติดต่อเซิร์ฟเวอร์ได้');
    }
}

// 4. ฟังก์ชันออกจากระบบ
function logout() {
    localStorage.clear(); // ลบตั๋ว (Token) ทิ้ง
    window.location.href = 'login.html'; // เด้งกลับหน้าล็อคอิน
}

// สั่งให้โหลดตารางทันทีเมื่อเข้าหน้านี้
fetchAdminTickets();

// ==========================================
// ระบบเพิ่มผู้ใช้งานใหม่โดย Admin
// ==========================================
document.getElementById('addUserForm').addEventListener('submit', async (e) => {
    e.preventDefault(); // ป้องกันหน้าเว็บรีเฟรช

    const username = document.getElementById('newUsername').value;
    const password = document.getElementById('newPassword').value;
    const role = document.getElementById('newRole').value;
    const msgObj = document.getElementById('addUserMsg');

    msgObj.style.color = '#0056b3';
    msgObj.innerText = 'กำลังบันทึกข้อมูลเข้าฐานข้อมูล...';

    try {
        // ยิงข้อมูลไปที่ API สร้างผู้ใช้ที่เรามีอยู่แล้วบนคลาวด์
        const response = await fetch('https://repair-system-backend-o7wo.onrender.com/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, role })
        });

        const data = await response.json();

        if (response.ok) {
            msgObj.style.color = 'green';
            msgObj.innerText = `✅ สำเร็จ! สร้างบัญชี "${username}" เรียบร้อยแล้ว`;
            document.getElementById('addUserForm').reset(); // ล้างข้อความในฟอร์มออก
            
            // ให้ข้อความสำเร็จหายไปเองใน 3 วินาที
            setTimeout(() => { msgObj.innerText = ''; }, 3000);
        } else {
            msgObj.style.color = 'red';
            msgObj.innerText = '❌ ' + data.error; // แจ้งเตือนเช่น "อาจมีชื่อนี้แล้ว"
        }
    } catch (error) {
        console.error(error);
        msgObj.style.color = 'red';
        msgObj.innerText = '❌ ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้';
    }
});

// =========================================================
// 1. ระบบ Dashboard Stats (ดึงสถิติมาแสดง)
// =========================================================
async function loadStats() {
    const res = await fetch('https://repair-system-backend-o7wo.onrender.com/api/dashboard/stats');
    const data = await res.json();
    document.getElementById('statTotal').innerText = data.total;
    document.getElementById('statPending').innerText = data.pending;
}
loadStats();

// =========================================================
// 2. การใช้ Debounce (ลดการยิง API ซ้ำๆ เวลาผู้ใช้พิมพ์ค้นหา)
// =========================================================
function debounce(func, delay) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}
document.getElementById('searchInput').addEventListener('input', debounce((e) => {
    console.log("กำลังค้นหา: ", e.target.value);
    // (สามารถใส่โค้ดฟิลเตอร์ตารางตรงนี้ได้)
}, 500)); // รอให้พิมพ์เสร็จ 0.5 วินาทีถึงจะทำงาน

// =========================================================
// 3. การใช้ Event Delegation (รับ Event จากตัวแม่คือ Table)
// =========================================================
// แทนที่จะใส่ปุ่ม onclick ทุกปุ่ม เราดักคลิกที่ตัวตารางทีเดียว
document.getElementById('adminTicketTable').addEventListener('click', async (e) => {
    // เช็คว่าสิ่งที่ถูกคลิกคือปุ่มที่มีคลาส delete-btn หรือไม่
    if (e.target.classList.contains('delete-btn')) {
        const ticketId = e.target.getAttribute('data-id');
        if (confirm('คุณแน่ใจหรือไม่ที่จะลบรายการนี้?')) {
            await fetch(`https://repair-system-backend-o7wo.onrender.com/api/tickets/${ticketId}`, { method: 'DELETE' });
            alert('ลบข้อมูลสำเร็จ');
            fetchAdminTickets(); // โหลดตารางใหม่
            loadStats(); // โหลดสถิติใหม่
        }
    }
});