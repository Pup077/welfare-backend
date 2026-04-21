// ==========================================
// ไฟล์: src/services/api.js
// ศูนย์รวมการเชื่อมต่อ API สำหรับ Frontend
// ==========================================

const BASE_URL = 'http://localhost:8000/api';

// Helper Function สำหรับจัดการ Error กลาง
async function handleResponse(response) {
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ');
    }
    return data;
}

// ==========================================
// 1. หมวดเจ้าหน้าที่ (Auth)
// ==========================================
export const AuthAPI = {
    // ล็อกอินเข้าสู่ระบบ
    login: async (username, password, terminal_id = 1) => {
        const res = await fetch(`${BASE_URL}/auth/login-secure`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, terminal_id })
        });
        return handleResponse(res);
    },
    // ลงทะเบียนแอดมินใหม่
    register: async (empData) => {
        const res = await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(empData)
        });
        return handleResponse(res);
    }
};

// ==========================================
// 2. หมวดข้อมูลสมาชิก (Members)
// ==========================================
export const MemberAPI = {
    // ดึงสมาชิกทั้งหมด (จำกัด 100 รายการ)
    getAll: async () => {
        const res = await fetch(`${BASE_URL}/members`);
        return handleResponse(res);
    },
    // ค้นหาสมาชิก (ใช้ ?q=ชื่อ หรือ ?community_id=1)
    search: async (queryString) => {
        // ตัวอย่าง queryString: "q=สมชาย&community_id=1"
        const res = await fetch(`${BASE_URL}/members/search?${queryString}`);
        return handleResponse(res);
    },
    // ดึงข้อมูลสมาชิก 1 คน (เพื่อดูประวัติ/แก้ไข)
    getById: async (id) => {
        const res = await fetch(`${BASE_URL}/members/${id}`);
        return handleResponse(res);
    },
    // เพิ่มสมาชิกใหม่
    create: async (memberData) => {
        const res = await fetch(`${BASE_URL}/members`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(memberData)
        });
        return handleResponse(res);
    },
    // อัปเดต/ยกเลิกสมาชิก
    update: async (id, updateData) => {
        const res = await fetch(`${BASE_URL}/members/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        });
        return handleResponse(res);
    }
};

// ==========================================
// 3. หมวดรายรับ (Incomes)
// ==========================================
export const IncomeAPI = {
    // บันทึกใบเสร็จรับเงิน (ส่งงวดมาเป็น Array)
    createReceipt: async (receiptData) => {
        const res = await fetch(`${BASE_URL}/incomes/receipts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(receiptData)
        });
        return handleResponse(res);
    },
    // ดึงประวัติว่าสมาชิกคนนี้จ่ายถึงงวดไหนแล้ว
    getInstallmentsByMember: async (memberId) => {
        const res = await fetch(`${BASE_URL}/members/${memberId}/installments`);
        return handleResponse(res);
    },
    // ยกเลิกใบเสร็จ
    voidReceipt: async (receiptId, reason) => {
        const res = await fetch(`${BASE_URL}/incomes/receipts/${receiptId}/void`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ void_reason: reason })
        });
        return handleResponse(res);
    }
};

// ==========================================
// 4. หมวดรายจ่าย (Expenses)
// ==========================================
export const ExpenseAPI = {
    // เบิกค่าชดเชยโรงพยาบาล
    createHospitalVoucher: async (voucherData) => {
        const res = await fetch(`${BASE_URL}/expenses/hospital`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(voucherData)
        });
        return handleResponse(res);
    },
    // เบิกค่าทำศพ
    createFuneralVoucher: async (voucherData) => {
        const res = await fetch(`${BASE_URL}/expenses/funeral`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(voucherData)
        });
        return handleResponse(res);
    }
};

// ==========================================
// 5. หมวดรายงาน (Reports)
// ==========================================
export const ReportAPI = {
    // ยอดรับเงินรายวัน
    getDailyIncome: async (dateStr) => { // ส่งแบบ 'YYYY-MM-DD'
        const res = await fetch(`${BASE_URL}/reports/daily-income?date=${dateStr}`);
        return handleResponse(res);
    },
    // สมาชิกค้างชำระ (> 3 งวด)
    getWeeklyIncome: async () => {
        const res = await fetch(`${BASE_URL}/reports/weekly-income`);
        return handleResponse(res);
    },
    getMonthlyIncome: async () => {
        const res = await fetch(`${BASE_URL}/reports/monthly-income`);
        return handleResponse(res);
    },
    getYearlyIncome: async () => {
        const res = await fetch(`${BASE_URL}/reports/yearly-income`);
        return handleResponse(res);
    },
    getOverdue: async () => {
        const res = await fetch(`${BASE_URL}/reports/overdue`);
        return handleResponse(res);
    },
    getOverdueSummary: async () => {
        const res = await fetch(`${BASE_URL}/reports/overdue-summary`);
        return handleResponse(res);
    },
    // สรุปรายจ่าย (type = 'hospital' หรือ 'funeral')
    getExpenses: async (type, startDate, endDate) => {
        const res = await fetch(`${BASE_URL}/reports/expenses?type=${type}&start_date=${startDate}&end_date=${endDate}`);
        return handleResponse(res);
    }
};

// ==========================================
// 6. หมวดตัวช่วยและการตั้งค่า (Utils & Settings)
// ==========================================
export const UtilAPI = {
    // ดึงข้อมูล Dropdown ทั้งหมด (คำนำหน้า, อาชีพ, ตำบล ฯลฯ)
    getReferences: async () => {
        const res = await fetch(`${BASE_URL}/references`);
        return handleResponse(res);
    },
    // ขอเลขที่เอกสารล่าสุด (type: 'member', 'receipt', 'voucher')
    getNextNumber: async (type) => {
        const res = await fetch(`${BASE_URL}/utils/next-number/${type}`);
        return handleResponse(res);
    },
    // ดึงการตั้งค่าระบบ (เช่น ค่าสมทบรายเดือน)
    getSettings: async () => {
        const res = await fetch(`${BASE_URL}/settings`);
        return handleResponse(res);
    }
};
