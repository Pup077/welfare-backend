// ==========================================
// ไฟล์: services/api.js
// หน้าที่: รวมคลาสเรียก API สำหรับหน้าเว็บที่ต้องการใช้งานแบบ OOP
// ==========================================

class BaseApiService {
    constructor(baseUrl = 'http://localhost:8000/api') {
        this.baseUrl = baseUrl;
    }

    // เมธอดกลางสำหรับยิง request และแปลง error ให้รูปแบบเดียวกัน
    async request(path, options = {}) {
        const response = await fetch(`${this.baseUrl}${path}`, {
            headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
            ...options
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok || result.status === 'error') {
            throw new Error(result.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อระบบ');
        }

        return result;
    }

    get(path) {
        return this.request(path);
    }

    post(path, payload) {
        return this.request(path, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    }

    put(path, payload) {
        return this.request(path, {
            method: 'PUT',
            body: JSON.stringify(payload)
        });
    }
}

class AuthService extends BaseApiService {
    login(username, password, terminalId = 1) {
        return this.post('/auth/login-secure', {
            username,
            password,
            terminal_id: terminalId
        });
    }

    register(employeeData) {
        return this.post('/auth/register', employeeData);
    }

    setPassword(empCode, password) {
        return this.post('/auth/set-password', {
            emp_code: empCode,
            password
        });
    }
}

class MemberService extends BaseApiService {
    getAll() {
        return this.get('/members');
    }

    search(queryString) {
        return this.get(`/members/search?${queryString}`);
    }

    getById(id) {
        return this.get(`/members/${id}`);
    }

    create(memberData) {
        return this.post('/members', memberData);
    }

    update(id, updateData) {
        return this.put(`/members/${id}`, updateData);
    }

    getInstallmentsByMember(memberId) {
        return this.get(`/members/${memberId}/installments`);
    }
}

class IncomeService extends BaseApiService {
    createReceipt(receiptData) {
        return this.post('/incomes/receipts', receiptData);
    }

    voidReceipt(receiptId, reason) {
        return this.put(`/incomes/receipts/${receiptId}/void`, {
            void_reason: reason
        });
    }
}

class ExpenseService extends BaseApiService {
    createHospitalVoucher(voucherData) {
        return this.post('/expenses/hospital', voucherData);
    }

    createFuneralVoucher(voucherData) {
        return this.post('/expenses/funeral', voucherData);
    }
}

class ReportService extends BaseApiService {
    getDailyIncome(dateStr) {
        return this.get(`/reports/daily-income?date=${dateStr}`);
    }

    getWeeklyIncome() {
        return this.get('/reports/weekly-income');
    }

    getMonthlyIncome() {
        return this.get('/reports/monthly-income');
    }

    getYearlyIncome() {
        return this.get('/reports/yearly-income');
    }

    getOverdue() {
        return this.get('/reports/overdue');
    }

    getOverdueSummary() {
        return this.get('/reports/overdue-summary');
    }

    getExpenses(type, startDate, endDate) {
        return this.get(`/reports/expenses?type=${type}&start_date=${startDate}&end_date=${endDate}`);
    }
}

class UtilityService extends BaseApiService {
    getReferences() {
        return this.get('/references');
    }

    getNextNumber(type) {
        return this.get(`/utils/next-number/${type}`);
    }

    getSettings() {
        return this.get('/settings');
    }
}

window.WelfareApi = {
    BaseApiService,
    AuthService,
    MemberService,
    IncomeService,
    ExpenseService,
    ReportService,
    UtilityService
};
