// กำหนดที่อยู่ของ API ที่เราเพิ่งสร้างรันไว้บน Render
const API_URL = 'https://repair-system-backend-o7wo.onrender.com/api/tickets';

// 1. ฟังก์ชันดึงข้อมูลจาก Backend มาแสดง (Fetch API)
async function fetchTickets() {
    try {
        const response = await fetch(API_URL);
        
        // ถ้าสถานะไม่ใช่ 200 OK ให้ดึงข้อความ Error จากเซิร์ฟเวอร์มาแสดง
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'ไม่สามารถดึงข้อมูลได้');
        }
        
        const tickets = await response.json();
        renderTable(tickets);
        
        document.getElementById('stats-container').innerText = `มีรายการแจ้งซ่อมในระบบทั้งหมด ${tickets.length} รายการ`;

    } catch (error) {
        console.error('Error:', error);
        // นำ error.message จาก Backend มาแสดงในตารางแทนข้อความเดิม
        document.querySelector('#ticketTable tbody').innerHTML = 
            `<tr><td colspan="3" style="text-align:center; color:red;">${error.message}</td></tr>`;
    }
}

// 2. ฟังก์ชันวาดตาราง HTML (Render Table)
function renderTable(tickets) {
    const tbody = document.querySelector('#ticketTable tbody');
    tbody.innerHTML = ''; // ล้างข้อมูลจำลอง (Mock) อันเก่าทิ้ง

    if (tickets.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">ยังไม่มีข้อมูลแจ้งซ่อม</td></tr>';
        return;
    }

    tickets.forEach(ticket => {
        const tr = document.createElement('tr');
        tr.dataset.id = ticket.id; // ฝัง ID ไว้ที่แถว (เพื่อใช้กับ Event Delegation)

        // แปลงสถานะเป็นภาษาไทยให้ดูง่ายขึ้น
        let statusText = '';
        if(ticket.status === 'pending') statusText = 'รอดำเนินการ';
        else if(ticket.status === 'in_progress') statusText = 'กำลังซ่อม';
        else if(ticket.status === 'resolved') statusText = 'เสร็จสิ้น';
        else statusText = 'ยกเลิก';

        // สร้าง HTML ยัดเข้าไปในตาราง (ใช้ data-label รองรับ Mobile ตาม CSS ที่ทำไว้)
        tr.innerHTML = `
            <td data-label="รหัสอุปกรณ์">${ticket.equipment_code || 'ไม่ระบุ'}</td>
            <td data-label="สถานะ">${statusText}</td>
            <td data-label="จัดการ"><button class="btn-update">อัปเดตสถานะ</button></td>
        `;
        tbody.appendChild(tr);
    });
}

// 3. มาตรฐาน S5: ระบบ Debounce สำหรับช่องค้นหา
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
searchInput.addEventListener('input', debounce((event) => {
    const searchTerm = event.target.value.toLowerCase();
    const rows = document.querySelectorAll('#ticketTable tbody tr');
    
    // ค้นหาและกรองแถวในตาราง
    rows.forEach(row => {
        const eqCode = row.querySelector('td').textContent.toLowerCase();
        if (eqCode.includes(searchTerm)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}, 300)); // หน่วงเวลา 300 มิลลิวินาที ป้องกันระบบค้างถ้าพิมพ์เร็วเกินไป

// 4. มาตรฐาน S5: ระบบ Event Delegation สำหรับปุ่มกดในตาราง
const ticketTable = document.getElementById('ticketTable');
ticketTable.addEventListener('click', (event) => {
    // เช็คว่าคลิกโดนปุ่มอัปเดตหรือไม่
    if (event.target.classList.contains('btn-update')) {
        const row = event.target.closest('tr');
        const ticketId = row.dataset.id;
        
        // ตรงนี้สามารถเอา ID ไปยิง API อัปเดตข้อมูลต่อได้ (ในที่นี้แสดง Alert เป็นตัวอย่าง)
        alert(`คุณกำลังจะจัดการใบแจ้งซ่อมรหัส (Ticket ID): ${ticketId}`);
        // หมายเหตุ: ไม่ใช้ event.stopPropagation() ตามมาตรฐานบังคับ
    }
});

// เริ่มต้นทำงานทันทีที่โหลดหน้าเว็บเสร็จ
document.addEventListener('DOMContentLoaded', fetchTickets);

// ==========================================
// ระบบความปลอดภัย (ดักไม่ให้คนไม่ได้ล็อคอินเข้ามาใช้)
// ==========================================
const token = localStorage.getItem('token');
if (!token) {
    alert('กรุณาเข้าสู่ระบบก่อนใช้งาน');
    window.location.href = 'login.html';
}

// ==========================================
// ฟังก์ชันเมื่อผู้ใช้กดปุ่ม "ส่งแจ้งซ่อม"
// ==========================================
document.getElementById('ticketForm').addEventListener('submit', async (e) => {
    e.preventDefault(); // ป้องกันหน้าเว็บรีเฟรช

    const eqCode = document.getElementById('eqCode').value;
    const issue = document.getElementById('issue').value;
    
    // แกะรหัส Token เพื่อเอา ID ของผู้ใช้งานที่กำลังล็อคอินอยู่
    const payload = JSON.parse(atob(token.split('.')[1]));
    const userId = payload.id;

    try {
        // ส่งข้อมูลข้ามไปให้ Backend บันทึกลง MySQL บนคลาวด์
        const response = await fetch('https://repair-system-backend-o7wo.onrender.com/api/tickets', {
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
            document.getElementById('ticketForm').reset(); // ล้างช่องกรอกข้อมูล
            fetchTickets(); // สั่งให้ตารางโหลดข้อมูลใหม่ทันที
        } else {
            alert('❌ เกิดข้อผิดพลาด: ' + data.error);
        }
    } catch (error) {
        console.error(error);
        alert('❌ ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้');
    }
});

// ==========================================
// ฟังก์ชันดึงข้อมูลจากฐานข้อมูลมาแสดงในตารางผู้ใช้
// ==========================================
async function fetchTicketsAPI() {
    try {
        // ยิงคำสั่งไปดึงรายการแจ้งซ่อมทั้งหมดจาก Backend บนคลาวด์
        const response = await fetch('https://repair-system-backend-o7wo.onrender.com/api/tickets');
        const tickets = await response.json();
        
        // หาตัวตารางบนหน้าเว็บ (อ้างอิงจาก tbody)
        const tbody = document.querySelector('table tbody');
        if (!tbody) return;
        
        // ล้างข้อมูลสมมติของเก่าทิ้งไปก่อน
        tbody.innerHTML = ''; 

        // ถ้ายังไม่มีคนแจ้งซ่อมเลย
        if (tickets.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">ยังไม่มีรายการแจ้งซ่อม</td></tr>';
            return;
        }

        // นำข้อมูลจริงจาก Database มาสร้างเป็นบรรทัดในตารางทีละรายการ
        tickets.forEach(ticket => {
            // แปลงชื่อสถานะภาษาอังกฤษให้เป็นภาษาไทย
            let statusText = ticket.status;
            let statusColor = 'black';
            
            if (ticket.status === 'pending') { statusText = 'รอดำเนินการ'; statusColor = '#ff9800'; }
            if (ticket.status === 'in_progress') { statusText = 'กำลังซ่อม'; statusColor = '#2196f3'; }
            if (ticket.status === 'resolved') { statusText = 'ซ่อมเสร็จสิ้น'; statusColor = '#4caf50'; }
            if (ticket.status === 'cancelled') { statusText = 'ยกเลิก'; statusColor = '#f44336'; }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><b>${ticket.equipment_code || 'ไม่ระบุ'}</b></td>
                <td style="color: ${statusColor}; font-weight: bold;">${statusText}</td>
                <td><span style="color: #999; font-size: 0.9em;">(เฉพาะช่าง)</span></td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error('ไม่สามารถดึงข้อมูลตารางได้:', error);
    }
}

// สั่งให้ตารางโหลดข้อมูลจริงทันทีเมื่อผู้ใช้เข้ามาที่หน้านี้
fetchTicketsAPI();