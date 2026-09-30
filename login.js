// ตัวแปรเก็บสถานะว่าตอนนี้อยู่แท็บไหน (เริ่มต้นที่ user)
let currentMode = 'user';

// อ้างอิง Element ต่างๆ บนหน้าเว็บ
const btnUser = document.getElementById('btnUser');
const btnAdmin = document.getElementById('btnAdmin');
const loginTitle = document.getElementById('loginTitle');
const submitBtn = document.getElementById('submitBtn');
const loginBox = document.getElementById('loginBox');
const errorMsg = document.getElementById('errorMsg');

// ฟังก์ชันเมื่อกดแท็บ "ผู้ใช้งานทั่วไป"
btnUser.addEventListener('click', () => {
    currentMode = 'user';
    btnUser.classList.add('active');
    btnAdmin.classList.remove('active');
    loginTitle.innerText = 'เข้าสู่ระบบ (ผู้ใช้ทั่วไป)';
    loginBox.style.borderTopColor = '#0056b3';
    submitBtn.style.backgroundColor = '#0056b3';
    errorMsg.innerText = '';
});

// ฟังก์ชันเมื่อกดแท็บ "ผู้ดูแลระบบ"
btnAdmin.addEventListener('click', () => {
    currentMode = 'admin';
    btnAdmin.classList.add('active');
    btnUser.classList.remove('active');
    loginTitle.innerText = 'เข้าสู่ระบบ (ผู้ดูแลระบบ)';
    loginBox.style.borderTopColor = '#dc3545';
    submitBtn.style.backgroundColor = '#dc3545';
    errorMsg.innerText = '';
});

// ฟังก์ชันจัดการตอนกดปุ่มล็อคอิน
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault(); 

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    errorMsg.style.color = '#0056b3';
    errorMsg.innerText = 'กำลังตรวจสอบข้อมูล...';

    try {
        const response = await fetch('http://localhost:3000/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            const userRole = data.role; // สิทธิ์จริงๆ ที่ได้จากฐานข้อมูล

            // เช็คว่าเลือกแท็บ Admin แต่สิทธิ์จริงๆ เป็นแค่ User หรือไม่
            if (currentMode === 'admin' && userRole === 'user') {
                errorMsg.style.color = 'red';
                errorMsg.innerText = 'บัญชีนี้ไม่มีสิทธิ์ผู้ดูแลระบบ!';
                return; // หยุดการทำงาน ไม่ให้เข้าสู่ระบบ
            }

            // ถ้ารหัสผ่านถูก และสิทธิ์ถูกต้อง ให้บันทึก Token
            localStorage.setItem('token', data.token);
            localStorage.setItem('role', userRole);

            // แยกเด้งไปหน้าเว็บตามสิทธิ์
            if (userRole === 'admin' || userRole === 'technician') {
                window.location.href = 'admin_dashboard.html'; // ไปหน้าหลังบ้าน
            } else {
                window.location.href = 'index.html'; // ไปหน้าผู้ใช้ทั่วไป
            }

        } else {
            errorMsg.style.color = 'red';
            errorMsg.innerText = data.error; 
        }
    } catch (error) {
        console.error(error);
        errorMsg.style.color = 'red';
        errorMsg.innerText = 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้';
    }
});