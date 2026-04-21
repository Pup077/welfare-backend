const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

// ==========================================
// 1. ตั้งค่าการเชื่อมต่อฐานข้อมูล MySQL
// ==========================================
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'db',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'welfare_password',
    database: process.env.DB_NAME || 'welfare_db',
    waitForConnections: true,
    connectionLimit: 20,
    queueLimit: 0,
    multipleStatements: true // อนุญาตให้รัน SQL หลายคำสั่งพร้อมกันได้
});
const promisePool = pool.promise();

// ฟังก์ชันเข้ารหัสผ่าน (Security)
function hashPassword(password) {
    const secretSalt = "WelfareFund_NakhonSi_2026"; 
    return crypto.createHash('sha256').update(password + secretSalt).digest('hex');
}

// ==========================================
// 2. ระบบติดตั้งและสร้างฐานข้อมูล (SETUP DB)
// ==========================================
app.get('/api/setup-db', async (req, res) => {
    try {
        // [A] สร้างตารางข้อมูลตั้งต้น (Reference & Config Tables)
        const setupQueries = `
            CREATE TABLE IF NOT EXISTS system_settings (
                setting_key VARCHAR(50) PRIMARY KEY,
                setting_value VARCHAR(255) NOT NULL,
                description TEXT
            );

            CREATE TABLE IF NOT EXISTS terminals (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL
            );

            CREATE TABLE IF NOT EXISTS employees (
                id INT AUTO_INCREMENT PRIMARY KEY,
                emp_code VARCHAR(20) UNIQUE,
                full_name VARCHAR(150) NOT NULL,
                position VARCHAR(100),
                password_hash VARCHAR(255),
                role ENUM('superadmin', 'admin', 'officer') DEFAULT 'officer'
            );

            CREATE TABLE IF NOT EXISTS bank_accounts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                account_no VARCHAR(50) UNIQUE NOT NULL,
                account_name VARCHAR(150) NOT NULL,
                bank_name VARCHAR(100),
                branch_name VARCHAR(100),
                balance DECIMAL(15,2) DEFAULT 0.00
            );

            CREATE TABLE IF NOT EXISTS transaction_categories (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(150) NOT NULL,
                type ENUM('income', 'expense') NOT NULL
            );

            CREATE TABLE IF NOT EXISTS prefixes (id INT PRIMARY KEY, name VARCHAR(20), gender VARCHAR(10));
            CREATE TABLE IF NOT EXISTS subdistricts (id INT PRIMARY KEY, name VARCHAR(100));
            CREATE TABLE IF NOT EXISTS communities (id INT PRIMARY KEY, name VARCHAR(100));
            CREATE TABLE IF NOT EXISTS occupations (id INT PRIMARY KEY, name VARCHAR(100));
            CREATE TABLE IF NOT EXISTS marital_statuses (id INT PRIMARY KEY, name VARCHAR(50));
            CREATE TABLE IF NOT EXISTS relationships (id INT PRIMARY KEY, name VARCHAR(50));
        `;
        await promisePool.query(setupQueries);

        // [B] สร้างตารางหลัก (Members)
        const createMembersTableQuery = `
            CREATE TABLE IF NOT EXISTS members (
                id INT AUTO_INCREMENT PRIMARY KEY,
                member_code VARCHAR(20) UNIQUE,
                national_id VARCHAR(13) UNIQUE,
                prefix_id INT,
                first_name VARCHAR(100) NOT NULL,
                last_name VARCHAR(100) NOT NULL,
                birth_date DATE,
                join_date DATE,
                is_disabled BOOLEAN DEFAULT FALSE,
                address TEXT,
                subdistrict_id INT,
                community_id INT,
                occupation_id INT,
                marital_status_id INT,
                phone VARCHAR(20),
                beneficiary_1_name VARCHAR(100),
                relationship_1_id INT,
                beneficiary_2_name VARCHAR(100),
                relationship_2_id INT,
                status ENUM('active', 'cancelled', 'deceased', 'expired') DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;
        await promisePool.query(createMembersTableQuery);

        // [C] สร้างตารางฝั่งรายรับ (Incomes)
        const incomeQueries = `
            CREATE TABLE IF NOT EXISTS receipts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                receipt_no VARCHAR(50) UNIQUE NOT NULL,
                receipt_date DATE NOT NULL,
                member_id INT,
                terminal_id INT,
                employee_id INT,
                total_amount DECIMAL(10,2) NOT NULL,
                status ENUM('active', 'voided') DEFAULT 'active',
                void_reason TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (member_id) REFERENCES members(id)
            );

            CREATE TABLE IF NOT EXISTS receipt_installments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                receipt_id INT NOT NULL,
                installment_no INT NOT NULL,
                period_date DATE,
                amount DECIMAL(10,2) NOT NULL,
                FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS other_incomes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                receipt_no VARCHAR(50) UNIQUE NOT NULL,
                receipt_date DATE NOT NULL,
                received_from VARCHAR(150),
                address TEXT,
                category_id INT,
                description TEXT,
                amount DECIMAL(10,2) NOT NULL,
                terminal_id INT,
                employee_id INT,
                FOREIGN KEY (category_id) REFERENCES transaction_categories(id)
            );
        `;
        await promisePool.query(incomeQueries);

        // [D] สร้างตารางฝั่งรายจ่าย (Expenses)
        const expenseQueries = `
            CREATE TABLE IF NOT EXISTS vouchers (
                id INT AUTO_INCREMENT PRIMARY KEY,
                voucher_no VARCHAR(50) UNIQUE NOT NULL,
                voucher_date DATE NOT NULL,
                member_id INT,
                terminal_id INT,
                employee_id INT,
                expense_type ENUM('hospital', 'funeral', 'other') NOT NULL,
                total_amount DECIMAL(10,2) NOT NULL,
                status ENUM('active', 'voided') DEFAULT 'active',
                void_reason TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (member_id) REFERENCES members(id)
            );

            CREATE TABLE IF NOT EXISTS hospital_compensations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                voucher_id INT NOT NULL,
                check_in_date DATE NOT NULL,
                check_out_date DATE NOT NULL,
                total_nights INT NOT NULL,
                rate_per_night DECIMAL(10,2) NOT NULL,
                FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS funeral_compensations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                voucher_id INT NOT NULL,
                death_date DATE NOT NULL,
                age_years INT,
                age_months INT,
                beneficiary_name VARCHAR(150),
                relationship_id INT,
                FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE CASCADE
            );
        `;
        await promisePool.query(expenseQueries);

        res.json({ status: "success", message: "สร้างฐานข้อมูลสมบูรณ์ 100% ครบทุกระบบ!" });
    } catch (error) {
        console.error("Setup DB Error:", error);
        res.status(500).json({ error: "เกิดข้อผิดพลาดในการสร้างตาราง", details: error.message });
    }
});

// ==========================================
// 3. ระบบเพิ่มข้อมูลตั้งต้น (SEED DB)
// ==========================================
app.get('/api/seed-db', async (req, res) => {
    try {
        const prefixes = [[1, 'นาย', 'ชาย'], [2, 'นาง', 'หญิง'], [3, 'นางสาว', 'หญิง'], [4, 'ด.ญ.', 'หญิง'], [5, 'ด.ช.', 'ชาย']];
        const subdistricts = [[1, 'คลัง'], [2, 'ท่าวัง'], [3, 'ในเมือง'], [4, 'โพธิ์เสด็จ'], [5, 'ท่าโพธิ์'], [6, 'นาเคียน']];
        
        // ข้อมูลชุมชน 67 แห่ง
        const communities = [
            [1, 'ชุมชนหัวถนนก้าวหน้า'], [2, 'ชุมชนศาลามีชัย'], [3, 'ชุมชนการเคหะแห่งชาตินครศรีธรรมราช'], [4, 'ชุมชนพระเวียง'], [5, 'ชุมชนเพชรจริก'], [6, 'ชุมชนท้าวโคตร'], [7, 'ชุมชนหอไตร'], [8, 'ชุมชนหัวท่า'], [9, 'ชุมชนประตูชัย-ไชยสิทธิ์'], [10, 'ชุมชนหลังวัดพระมหาธาตุ'], [11, 'ชุมชนหน้าวัดพระมหาธาตุ'],
            [12, 'ชุมชนศรีธรรมโศก'], [13, 'ชุมชนบุญนารอบ'], [14, 'ชุมชนสวนป่าน'], [15, 'ชุมชนตลาดท่าม้า'], [16, 'ชุมชนลูกแม่อ่างทอง'], [17, 'ชุมชนจำปาขอม'], [18, 'ชุมชนปิยะสุข'], [19, 'ชุมชนกรแก้ว'], [20, 'ชุมชนป้อมเพชร'], [21, 'ชุมชนมุมป้อม'], [22, 'ชุมชนสารีบุตร'], [23, 'ชุมชนประตูขาว'], [24, 'ชุมชนตลาดแขก'], [25, 'ชุมชนท่าช้าง'],
            [26, 'ชุมชนพะเนียด'], [27, 'ชุมชนเศรษฐีศรีนคร'], [28, 'ชุมชนบ่ออ่าง'], [29, 'ชุมชนคูขวาง-คลัง เขต 1'], [30, 'ชุมชนตลาดยาว'], [31, 'ชุมชนบ้านตก'], [32, 'ชุมชนหน้าสถานีรถไฟ เขตนอกโคก'], [33, 'ชุมชนหน้าทักษิณ'], [34, 'ชุมชนคูขวาง-ท่าวัง เขต 2'], [35, 'ชุมชนคูขวาง-ท่าวัง เขต 3'], [36, 'ชุมชนท่าโพธิ์'], [37, 'ชุมชนบางงัน'], [38, 'ชุมชนตากสิน-วัดชะเมา'], [39, 'ชุมชนราชนิคม'], [40, 'ชุมชนดอนไพร'], [41, 'ชุมชนนิยมสุข'], [42, 'ชุมชนมะขามชุม'], [43, 'ชุมชนป่าโล่ง'], [44, 'ชุมชนท่ามอญ (ศรีทวี)'], [45, 'ชุมชนหน้าสถานีรถไฟ เขตสะพานยาว'], [46, 'ชุมชนศิริสุข'],
            [47, 'ชุมชนตลาดหัวอิฐ'], [48, 'ชุมชนเคหะเอื้ออาทรสะพานยาว'], [49, 'ชุมชนสัมฤทธิ์ประสงค์'], [50, 'ชุมชนนอกไร่-สะพานยาว'], [51, 'ชุมชน บขส.'], [52, 'ชุมชนกอไผ่'], [53, 'ชุมชนบุญพาสันติ'], [54, 'ชุมชนนครอาชีวศึกษา'], [55, 'ชุมชนทุ่งจีน'], [56, 'ชุมชนไทยสมุทร'], [57, 'ชุมชนไสเจริญ'], [58, 'ชุมชนไทยบัณฑิต'], [59, 'ชุมชนทวดทอง'], [60, 'ชุมชนชุมแสง'], [61, 'ชุมชนหน้าแขวงทางหลวง นครศรีธรรมราช'], [62, 'ชุมชนสุขเจริญ (ต้นหว้า)'], [63, 'ชุมชนวัดหัวอิฐ'], [64, 'ชุมชนเทวบุรี-คลองห้วย'], [65, 'ชุมชนบ่อทรัพย์'], [66, 'ชุมชนบ้านโพธิ์'], [67, 'ชุมชนสันติธรรม']
        ];
        const marital_statuses = [[1, 'โสด'], [2, 'สมรส'], [3, 'หย่า'], [4, 'แยกกันอยู่'], [5, 'หม้าย']];
        const occupations = [[1, 'กรรมกร'], [2, 'การตลาด/การขาย'], [3, 'ข้าราชการบำนาญ'], [4, 'ค้าขาย'], [5, 'พนักงานทั่วไป']];
        const relationships = [[1, 'บุตร'], [2, 'ญาติ'], [3, 'ตา'], [4, 'น้อง'], [5, 'บิดา'], [19, 'บุตรเขย'], [20, 'บุตรสาว']];
        const categories = [[1, 'เงินบริจาค', 'income'], [2, 'ดอกเบี้ยธนาคาร', 'income'], [3, 'ค่าตอบแทนคณะกรรมการ', 'expense'], [4, 'ค่าใช้จ่ายเบ็ดเตล็ดอื่นๆ', 'expense'], [5, 'ค่ารับขวัญบุตร', 'expense']];
        const settings = [['monthly_contribution_fee', '30.00', 'ค่าสมทบรายเดือน (บาท)'], ['hospital_rate_per_night', '300.00', 'ค่าชดเชยนอน รพ. คืนละ (บาท)'], ['hospital_max_nights_per_year', '10', 'จำนวนคืนชดเชยสูงสุดต่อปี'], ['suspend_rights_months', '3', 'ยกเลิกสมาชิกเมื่อค้างชำระเกิน (งวด)']];

        await promisePool.query('INSERT IGNORE INTO prefixes (id, name, gender) VALUES ?', [prefixes]);
        await promisePool.query('INSERT IGNORE INTO subdistricts (id, name) VALUES ?', [subdistricts]);
        await promisePool.query('REPLACE INTO communities (id, name) VALUES ?', [communities]);
        await promisePool.query('INSERT IGNORE INTO marital_statuses (id, name) VALUES ?', [marital_statuses]);
        await promisePool.query('INSERT IGNORE INTO occupations (id, name) VALUES ?', [occupations]);
        await promisePool.query('INSERT IGNORE INTO relationships (id, name) VALUES ?', [relationships]);
        await promisePool.query('INSERT IGNORE INTO transaction_categories (id, name, type) VALUES ?', [categories]);
        await promisePool.query('INSERT IGNORE INTO system_settings (setting_key, setting_value, description) VALUES ?', [settings]);
        await promisePool.query(`INSERT IGNORE INTO terminals (id, name) VALUES (1, 'จุดรับเงินที่ 1 (เคาน์เตอร์)'), (2, 'จุดรับเงินที่ 2 (ลงพื้นที่)')`);
        
        // สร้างบัญชีผู้ดูแลระบบ (Superadmin)
        const hashedPassword = hashPassword('admin1234');
        await promisePool.query(`
            REPLACE INTO employees (id, emp_code, full_name, position, password_hash, role) 
            VALUES (1, 'ADMIN001', 'ผู้ดูแลระบบ', 'Superadmin', '${hashedPassword}', 'superadmin')
        `);

        res.json({ status: "success", message: "เพิ่มข้อมูล Seed Data เรียบร้อย!" });
    } catch (error) {
        res.status(500).json({ error: "เกิดข้อผิดพลาดในการ Seed Data", details: error.message });
    }
});


// ==========================================
// 4. API ระบบผู้ใช้งาน (Auth & Users)
// ==========================================

// [POST] เข้าสู่ระบบ (Login)
app.post('/api/auth/login-secure', async (req, res) => {
    try {
        const { username, password, terminal_id } = req.body;
        const hashedPassword = hashPassword(password); 

        const [users] = await promisePool.query(
            'SELECT * FROM employees WHERE emp_code = ? AND password_hash = ?', 
            [username, hashedPassword]
        );

        if (users.length === 0) {
            return res.status(401).json({ status: "error", message: "รหัสพนักงาน หรือ รหัสผ่านไม่ถูกต้อง!" });
        }

        const user = users[0];
        res.json({
            status: "success", 
            message: "เข้าสู่ระบบสำเร็จ",
            user: { 
                employee_id: user.id, 
                emp_code: user.emp_code, 
                full_name: user.full_name, 
                role: user.role || 'officer', 
                terminal_id: terminal_id || 1 
            }
        });
    } catch (error) {
        res.status(500).json({ status: "error", message: "ล็อกอินล้มเหลว" });
    }
});

// [POST] เปลี่ยนรหัสผ่านตัวเอง
app.post('/api/auth/set-password', async (req, res) => {
    try {
        const { emp_code, password } = req.body;
        const hashedPassword = hashPassword(password);
        const [result] = await promisePool.query('UPDATE employees SET password_hash = ? WHERE emp_code = ?', [hashedPassword, emp_code]);
        
        if (result.affectedRows === 0) return res.status(404).json({ status: "error", message: "ไม่พบรหัสพนักงานนี้" });
        res.json({ status: "success", message: "ตั้งรหัสผ่านสำเร็จ!" });
    } catch (error) {
        res.status(500).json({ status: "error", message: "ตั้งรหัสผ่านล้มเหลว" });
    }
});

// [GET] ดึงรายชื่อผู้ใช้ทั้งหมด (สำหรับหน้าจัดการผู้ใช้)
app.get('/api/users', async (req, res) => {
    try {
        const [rows] = await promisePool.query('SELECT id, emp_code, full_name, position, role FROM employees ORDER BY id ASC');
        res.json({ status: "success", data: rows });
    } catch (error) {
        res.status(500).json({ status: "error", message: "ดึงข้อมูลผู้ใช้งานล้มเหลว" });
    }
});

// [POST] สมัครผู้ใช้ใหม่ (รองรับ Role)
app.post('/api/auth/register', async (req, res) => {
    try {
        const { emp_code, full_name, position, password, role } = req.body;
        const [existing] = await promisePool.query('SELECT * FROM employees WHERE emp_code = ?', [emp_code]);
        if (existing.length > 0) return res.status(400).json({ status: "error", message: "รหัสเจ้าหน้าที่นี้ มีในระบบแล้ว!" });

        const hashedPassword = hashPassword(password);
        await promisePool.query(
            'INSERT INTO employees (emp_code, full_name, position, password_hash, role) VALUES (?, ?, ?, ?, ?)', 
            [emp_code, full_name, position, hashedPassword, role || 'officer']
        );
        res.status(201).json({ status: "success", message: "สร้างผู้ใช้งานใหม่เรียบร้อยแล้ว!" });
    } catch (error) {
        res.status(500).json({ status: "error", message: "สร้างผู้ใช้งานล้มเหลว" });
    }
});


// ==========================================
// 5. API ระบบจัดการสมาชิก (Members)
// ==========================================

// [GET] ดึงข้อมูลสมาชิกทั้งหมด
app.get('/api/members', async (req, res) => {
    try {
        const [rows] = await promisePool.query(`
            SELECT m.*, p.name AS prefix_name, s.name AS subdistrict_name, c.name AS community_name 
            FROM members m 
            LEFT JOIN prefixes p ON m.prefix_id = p.id 
            LEFT JOIN subdistricts s ON m.subdistrict_id = s.id 
            LEFT JOIN communities c ON m.community_id = c.id
            ORDER BY m.member_code ASC
        `);
        res.json({ status: "success", data: rows });
    } catch (error) {
        res.status(500).json({ status: "error", message: error.message });
    }
});

// [GET] ค้นหาสมาชิกแบบละเอียด (Advanced Search)
app.get('/api/members/search', async (req, res) => {
    try {
        const { q, community_id, status } = req.query;
        let sql = `
            SELECT m.*, p.name AS prefix_name, s.name AS subdistrict_name, c.name AS community_name 
            FROM members m 
            LEFT JOIN prefixes p ON m.prefix_id = p.id 
            LEFT JOIN subdistricts s ON m.subdistrict_id = s.id 
            LEFT JOIN communities c ON m.community_id = c.id 
            WHERE 1=1
        `;
        const params = [];
        if (q) { 
            sql += ` AND (m.first_name LIKE ? OR m.last_name LIKE ? OR m.member_code LIKE ? OR m.national_id LIKE ?)`; 
            const searchVal = `%${q}%`; params.push(searchVal, searchVal, searchVal, searchVal); 
        }
        if (community_id) { sql += ` AND m.community_id = ?`; params.push(community_id); }
        if (status) { sql += ` AND m.status = ?`; params.push(status); }
        
        sql += ` ORDER BY m.member_code ASC LIMIT 100`; 
        const [rows] = await promisePool.query(sql, params);
        res.json({ status: "success", count: rows.length, data: rows });
    } catch (error) {
        res.status(500).json({ status: "error", message: "ค้นหาล้มเหลว" });
    }
});

// [POST] เพิ่มสมาชิกใหม่
app.post('/api/members', async (req, res) => {
    try {
        const { 
            member_code, national_id, prefix_id, first_name, last_name, birth_date, join_date, 
            is_disabled, address, subdistrict_id, community_id, occupation_id, marital_status_id, 
            phone, beneficiary_1_name, relationship_1_id, beneficiary_2_name, relationship_2_id 
        } = req.body;
        
        const sql = `INSERT INTO members (member_code, national_id, prefix_id, first_name, last_name, birth_date, join_date, is_disabled, address, subdistrict_id, community_id, occupation_id, marital_status_id, phone, beneficiary_1_name, relationship_1_id, beneficiary_2_name, relationship_2_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        const values = [member_code, national_id, prefix_id, first_name, last_name, birth_date, join_date, is_disabled || false, address, subdistrict_id, community_id, occupation_id, marital_status_id, phone, beneficiary_1_name, relationship_1_id, beneficiary_2_name, relationship_2_id];
        
        const [result] = await promisePool.query(sql, values);
        res.status(201).json({ status: "success", message: "เพิ่มข้อมูลสมาชิกใหม่เรียบร้อยแล้ว", member_id: result.insertId });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ status: "error", message: "รหัสสมาชิก หรือ เลขบัตรประชาชน ซ้ำในระบบ" });
        res.status(500).json({ status: "error", message: "บันทึกข้อมูลล้มเหลว", details: error.message });
    }
});

// [GET] ข้อมูลสมาชิก 1 คน
app.get('/api/members/:id', async (req, res) => {
    try {
        const [rows] = await promisePool.query('SELECT * FROM members WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ status: "error", message: "ไม่พบข้อมูลสมาชิกนี้" });
        res.json({ status: "success", data: rows[0] });
    } catch (error) {
        res.status(500).json({ status: "error", message: "ดึงข้อมูลล้มเหลว" });
    }
});

// [PUT] แก้ไขข้อมูล/สถานะสมาชิก
app.put('/api/members/:id', async (req, res) => {
    try {
        const updateData = req.body;
        if(updateData.status) {
            await promisePool.query('UPDATE members SET status = ? WHERE id = ?', [updateData.status, req.params.id]);
            return res.json({ status: "success", message: "อัปเดตสถานะสมาชิกสำเร็จ" });
        }
        res.json({ status: "success", message: "อัปเดตข้อมูลสำเร็จ" });
    } catch (error) {
        res.status(500).json({ status: "error", message: "อัปเดตข้อมูลล้มเหลว" });
    }
});

// [GET] ดึงประวัติการจ่ายเงินของสมาชิก
app.get('/api/members/:id/installments', async (req, res) => {
    try {
        const [rows] = await promisePool.query(`
            SELECT r.receipt_no, r.receipt_date, i.installment_no, i.period_date, i.amount 
            FROM receipts r 
            JOIN receipt_installments i ON r.id = i.receipt_id 
            WHERE r.member_id = ? AND r.status = 'active' 
            ORDER BY i.installment_no DESC
        `, [req.params.id]);
        res.json({ status: "success", data: rows });
    } catch (error) {
        res.status(500).json({ status: "error", message: "ดึงประวัติการจ่ายเงินล้มเหลว" });
    }
});

// [GET] ดึงข้อมูลอ้างอิงทั้งหมด (Dropdowns)
app.get('/api/references', async (req, res) => {
    try {
        const [prefixes] = await promisePool.query('SELECT * FROM prefixes');
        const [subdistricts] = await promisePool.query('SELECT * FROM subdistricts');
        const [communities] = await promisePool.query('SELECT * FROM communities ORDER BY id ASC');
        const [occupations] = await promisePool.query('SELECT * FROM occupations');
        const [marital_statuses] = await promisePool.query('SELECT * FROM marital_statuses');
        const [relationships] = await promisePool.query('SELECT * FROM relationships');
        const [terminals] = await promisePool.query('SELECT * FROM terminals');
        
        res.json({ status: "success", data: { prefixes, subdistricts, communities, occupations, marital_statuses, relationships, terminals } });
    } catch (error) {
        res.status(500).json({ status: "error", message: "ดึงข้อมูลอ้างอิงล้มเหลว" });
    }
});


// ==========================================
// 6. API ระบบการเงิน (Incomes & Expenses)
// ==========================================

// [POST] รับเงินสมทบ (ออกใบเสร็จ)
app.post('/api/incomes/receipts', async (req, res) => {
    const connection = await promisePool.getConnection();
    try {
        await connection.beginTransaction();
        const { receipt_no, receipt_date, member_id, terminal_id, employee_id, installments } = req.body;
        
        const total_amount = installments.reduce((sum, item) => sum + parseFloat(item.amount), 0);
        
        const [receiptResult] = await connection.query(
            `INSERT INTO receipts (receipt_no, receipt_date, member_id, terminal_id, employee_id, total_amount) VALUES (?, ?, ?, ?, ?, ?)`, 
            [receipt_no, receipt_date, member_id, terminal_id, employee_id, total_amount]
        );
        const receipt_id = receiptResult.insertId;
        
        const installmentValues = installments.map(item => [receipt_id, item.installment_no, item.period_date, item.amount]);
        await connection.query(`INSERT INTO receipt_installments (receipt_id, installment_no, period_date, amount) VALUES ?`, [installmentValues]);
        
        await connection.commit();
        res.status(201).json({ status: "success", message: "บันทึกใบเสร็จรับเงินสำเร็จ", receipt_id });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ status: "error", message: "บันทึกรับเงินล้มเหลว", details: error.message });
    } finally { 
        connection.release(); 
    }
});

// [PUT] ยกเลิกใบเสร็จรับเงิน (Void)
app.get('/api/incomes/receipts/:id', async (req, res) => {
    try {
        const [receiptRows] = await promisePool.query(`
            SELECT
                r.id,
                r.receipt_no,
                r.receipt_date,
                r.total_amount,
                r.status,
                m.member_code,
                m.first_name,
                m.last_name
            FROM receipts r
            LEFT JOIN members m ON r.member_id = m.id
            WHERE r.id = ?
            LIMIT 1
        `, [req.params.id]);

        if (!receiptRows.length) {
            return res.status(404).json({ status: "error", message: "ไม่พบใบเสร็จนี้" });
        }

        const [installmentRows] = await promisePool.query(`
            SELECT installment_no, period_date, amount
            FROM receipt_installments
            WHERE receipt_id = ?
            ORDER BY installment_no ASC, period_date ASC
        `, [req.params.id]);

        res.json({
            status: "success",
            data: {
                ...receiptRows[0],
                installments: installmentRows
            }
        });
    } catch (error) {
        res.status(500).json({ status: "error", message: "ดึงรายละเอียดใบเสร็จล้มเหลว" });
    }
});

app.put('/api/incomes/receipts/:id/void', async (req, res) => {
    try {
        const { void_reason } = req.body; 
        const [result] = await promisePool.query(
            `UPDATE receipts SET status = 'voided', void_reason = ? WHERE id = ?`, 
            [void_reason, req.params.id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ status: "error", message: "ไม่พบใบเสร็จนี้" });
        res.json({ status: "success", message: "ยกเลิกใบเสร็จเรียบร้อยแล้ว" });
    } catch (error) {
        res.status(500).json({ status: "error", message: "ยกเลิกใบเสร็จล้มเหลว" });
    }
});

// [POST] จ่ายเงินชดเชยโรงพยาบาล
app.post('/api/expenses/hospital', async (req, res) => {
    const connection = await promisePool.getConnection();
    try {
        await connection.beginTransaction();
        const { voucher_no, voucher_date, member_id, terminal_id, employee_id, check_in_date, check_out_date, total_nights, rate_per_night } = req.body;
        
        const total_amount = parseFloat(total_nights) * parseFloat(rate_per_night);
        
        const [voucherResult] = await connection.query(
            `INSERT INTO vouchers (voucher_no, voucher_date, member_id, terminal_id, employee_id, expense_type, total_amount) VALUES (?, ?, ?, ?, ?, 'hospital', ?)`, 
            [voucher_no, voucher_date, member_id, terminal_id, employee_id, total_amount]
        );
        
        await connection.query(
            `INSERT INTO hospital_compensations (voucher_id, check_in_date, check_out_date, total_nights, rate_per_night) VALUES (?, ?, ?, ?, ?)`, 
            [voucherResult.insertId, check_in_date, check_out_date, total_nights, rate_per_night]
        );
        
        await connection.commit();
        res.status(201).json({ status: "success", message: "บันทึกจ่ายเงินชดเชย รพ. สำเร็จ" });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ status: "error", message: "บันทึกจ่ายเงินล้มเหลว" });
    } finally { 
        connection.release(); 
    }
});

// [POST] จ่ายเงินค่าจัดการศพ
app.post('/api/expenses/funeral', async (req, res) => {
    const connection = await promisePool.getConnection();
    try {
        await connection.beginTransaction();
        const { voucher_no, voucher_date, member_id, terminal_id, employee_id, death_date, age_years, age_months, beneficiary_name, relationship_id, total_amount } = req.body;
        
        const [voucherResult] = await connection.query(
            `INSERT INTO vouchers (voucher_no, voucher_date, member_id, terminal_id, employee_id, expense_type, total_amount) VALUES (?, ?, ?, ?, ?, 'funeral', ?)`, 
            [voucher_no, voucher_date, member_id, terminal_id, employee_id, total_amount]
        );
        
        await connection.query(
            `INSERT INTO funeral_compensations (voucher_id, death_date, age_years, age_months, beneficiary_name, relationship_id) VALUES (?, ?, ?, ?, ?, ?)`, 
            [voucherResult.insertId, death_date, age_years, age_months, beneficiary_name, relationship_id]
        );
        
        // อัปเดตสถานะเป็น เสียชีวิต
        await connection.query(`UPDATE members SET status = 'deceased' WHERE id = ?`, [member_id]);
        
        await connection.commit();
        res.status(201).json({ status: "success", message: "บันทึกจ่ายเงินค่าจัดการศพ สำเร็จ" });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ status: "error", message: "บันทึกจ่ายเงินล้มเหลว" });
    } finally { 
        connection.release(); 
    }
});


// ==========================================
// 7. API ระบบรายงาน (Reports & Utils)
// ==========================================

// [GET] รายงานรับเงินประจำวัน
app.get('/api/reports/daily-income', async (req, res) => {
    try {
        const { start_date, end_date, date } = req.query;
        const reportStartDate = start_date || date;
        const reportEndDate = end_date || date;

        if (!reportStartDate || !reportEndDate) {
            return res.status(400).json({ status: "error", message: "กรุณาระบุวันที่หรือช่วงวันที่" });
        }

        const [rows] = await promisePool.query(`
            SELECT r.id, r.receipt_no, r.receipt_date, m.member_code, m.first_name, m.last_name, r.total_amount 
            FROM receipts r 
            LEFT JOIN members m ON r.member_id = m.id 
            WHERE r.receipt_date BETWEEN ? AND ? AND r.status = 'active' 
            ORDER BY r.receipt_date ASC, r.receipt_no ASC
        `, [reportStartDate, reportEndDate]);
        
        const totalSum = rows.reduce((sum, current) => sum + parseFloat(current.total_amount), 0);
        res.json({ status: "success", data: rows, summary: { total_amount: totalSum } });
    } catch (error) {
        res.status(500).json({ status: "error", message: "ดึงข้อมูลรายงานล้มเหลว" });
    }
});

// [GET] รายงานค้างชำระ
// [GET] รายงานรับเงินประจำเดือนปัจจุบัน
app.get('/api/reports/weekly-income', async (req, res) => {
    try {
        const [rows] = await promisePool.query(`
            SELECT COALESCE(SUM(total_amount), 0) AS total_amount
            FROM receipts
            WHERE status = 'active'
              AND YEARWEEK(receipt_date, 1) = YEARWEEK(CURRENT_DATE, 1)
        `);
        res.json({ status: "success", summary: { total_amount: parseFloat(rows[0].total_amount) || 0 } });
    } catch (error) {
        res.status(500).json({ status: "error", message: "ดึงข้อมูลยอดรับเงินสมทบรายสัปดาห์ล้มเหลว" });
    }
});

app.get('/api/reports/monthly-income', async (req, res) => {
    try {
        const [rows] = await promisePool.query(`
            SELECT COALESCE(SUM(total_amount), 0) AS total_amount
            FROM receipts
            WHERE status = 'active'
              AND YEAR(receipt_date) = YEAR(CURRENT_DATE)
              AND MONTH(receipt_date) = MONTH(CURRENT_DATE)
        `);
        res.json({ status: "success", summary: { total_amount: parseFloat(rows[0].total_amount) || 0 } });
    } catch (error) {
        res.status(500).json({ status: "error", message: "ดึงข้อมูลยอดรับเงินสมทบรายเดือนล้มเหลว" });
    }
});

// [GET] รายงานรับเงินประจำปีปัจจุบัน
app.get('/api/reports/yearly-income', async (req, res) => {
    try {
        const [rows] = await promisePool.query(`
            SELECT COALESCE(SUM(total_amount), 0) AS total_amount
            FROM receipts
            WHERE status = 'active'
              AND YEAR(receipt_date) = YEAR(CURRENT_DATE)
        `);
        res.json({ status: "success", summary: { total_amount: parseFloat(rows[0].total_amount) || 0 } });
    } catch (error) {
        res.status(500).json({ status: "error", message: "ดึงข้อมูลยอดรับเงินสมทบรายปีล้มเหลว" });
    }
});

app.get('/api/reports/overdue', async (req, res) => {
    try {
        const [rows] = await promisePool.query(`
            SELECT m.member_code, m.first_name, m.last_name, 
            MAX(ri.period_date) as last_paid_month, 
            TIMESTAMPDIFF(MONTH, MAX(ri.period_date), CURRENT_DATE) as overdue_months 
            FROM members m 
            LEFT JOIN receipts r ON m.id = r.member_id AND r.status = 'active' 
            LEFT JOIN receipt_installments ri ON r.id = ri.receipt_id 
            WHERE m.status = 'active' 
            GROUP BY m.id 
            HAVING overdue_months >= 3 OR overdue_months IS NULL 
            ORDER BY overdue_months DESC
        `);
        res.json({ status: "success", total_overdue_members: rows.length, data: rows });
    } catch (error) {
        res.status(500).json({ status: "error", message: "ดึงข้อมูลค้างชำระล้มเหลว" });
    }
});

// [GET] รายงานจ่ายเงินสวัสดิการ
app.get('/api/reports/overdue-summary', async (req, res) => {
    try {
        const [rows] = await promisePool.query(`
            SELECT
                SUM(CASE WHEN DATE(overdue_since) = CURRENT_DATE THEN 1 ELSE 0 END) AS daily_count,
                SUM(CASE WHEN YEARWEEK(overdue_since, 1) = YEARWEEK(CURRENT_DATE, 1) THEN 1 ELSE 0 END) AS weekly_count,
                SUM(CASE WHEN YEAR(overdue_since) = YEAR(CURRENT_DATE) AND MONTH(overdue_since) = MONTH(CURRENT_DATE) THEN 1 ELSE 0 END) AS monthly_count,
                SUM(CASE WHEN YEAR(overdue_since) = YEAR(CURRENT_DATE) THEN 1 ELSE 0 END) AS yearly_count
            FROM (
                SELECT
                    CASE
                        WHEN MAX(ri.period_date) IS NOT NULL THEN DATE_ADD(MAX(ri.period_date), INTERVAL 3 MONTH)
                        WHEN m.join_date IS NOT NULL THEN DATE_ADD(m.join_date, INTERVAL 3 MONTH)
                        ELSE NULL
                    END AS overdue_since
                FROM members m
                LEFT JOIN receipts r ON m.id = r.member_id AND r.status = 'active'
                LEFT JOIN receipt_installments ri ON r.id = ri.receipt_id
                WHERE m.status = 'active'
                GROUP BY m.id, m.join_date
                HAVING overdue_since IS NOT NULL AND overdue_since <= CURRENT_DATE
            ) overdue_members
        `);

        res.json({
            status: "success",
            summary: {
                daily_count: parseInt(rows[0].daily_count || 0, 10),
                weekly_count: parseInt(rows[0].weekly_count || 0, 10),
                monthly_count: parseInt(rows[0].monthly_count || 0, 10),
                yearly_count: parseInt(rows[0].yearly_count || 0, 10)
            }
        });
    } catch (error) {
        res.status(500).json({ status: "error", message: "ดึงข้อมูลสรุปสมาชิกค้างชำระล้มเหลว" });
    }
});

app.get('/api/reports/expenses', async (req, res) => {
    try {
        const { type, start_date, end_date } = req.query;
        let sql = type === 'funeral' 
            ? `SELECT v.voucher_no, v.voucher_date, m.member_code, m.first_name, m.last_name, fc.death_date, v.total_amount FROM vouchers v JOIN funeral_compensations fc ON v.id = fc.voucher_id JOIN members m ON v.member_id = m.id WHERE v.status = 'active' AND v.voucher_date BETWEEN ? AND ?` 
            : `SELECT v.voucher_no, v.voucher_date, m.member_code, m.first_name, m.last_name, hc.check_in_date, hc.check_out_date, hc.total_nights, v.total_amount FROM vouchers v JOIN hospital_compensations hc ON v.id = hc.voucher_id JOIN members m ON v.member_id = m.id WHERE v.status = 'active' AND v.voucher_date BETWEEN ? AND ?`;
        
        const [rows] = await promisePool.query(sql, [start_date, end_date]);
        const totalExpense = rows.reduce((sum, current) => sum + parseFloat(current.total_amount), 0);
        
        res.json({ status: "success", data: rows, summary: { total_expense_amount: totalExpense } });
    } catch (error) {
        res.status(500).json({ status: "error", message: "ดึงข้อมูลรายจ่ายล้มเหลว" });
    }
});

// [GET] ระบบรันเลขที่เอกสารอัตโนมัติ (Auto-Running)
app.get('/api/reports/transactions', async (req, res) => {
    try {
        const { date } = req.query;
        const [rows] = await promisePool.query(`
            SELECT
                r.receipt_date AS transaction_date,
                r.receipt_no AS document_no,
                'รับเงินสมทบ' AS transaction_type,
                CONCAT('รับเงินสมทบ ', COUNT(ri.id), ' งวด') AS description,
                CONCAT(COALESCE(m.member_code, '-'), ' ', COALESCE(m.first_name, ''), ' ', COALESCE(m.last_name, '')) AS party_name,
                r.total_amount AS amount
            FROM receipts r
            LEFT JOIN members m ON r.member_id = m.id
            LEFT JOIN receipt_installments ri ON r.id = ri.receipt_id
            WHERE r.status = 'active' AND r.receipt_date = ?
            GROUP BY r.id, r.receipt_date, r.receipt_no, m.member_code, m.first_name, m.last_name, r.total_amount

            UNION ALL

            SELECT
                v.voucher_date AS transaction_date,
                v.voucher_no AS document_no,
                'จ่ายสวัสดิการ' AS transaction_type,
                CASE
                    WHEN v.expense_type = 'hospital' THEN 'ค่าชดเชยนอนโรงพยาบาล'
                    WHEN v.expense_type = 'funeral' THEN 'ค่าจัดการศพ'
                    ELSE 'จ่ายสวัสดิการ'
                END AS description,
                CONCAT(COALESCE(m.member_code, '-'), ' ', COALESCE(m.first_name, ''), ' ', COALESCE(m.last_name, '')) AS party_name,
                v.total_amount AS amount
            FROM vouchers v
            LEFT JOIN members m ON v.member_id = m.id
            WHERE v.status = 'active' AND v.voucher_date = ?

            ORDER BY transaction_date DESC, document_no DESC
        `, [date, date]);

        const totalAmount = rows.reduce((sum, row) => sum + parseFloat(row.amount || 0), 0);
        res.json({ status: "success", data: rows, summary: { total_amount: totalAmount } });
    } catch (error) {
        res.status(500).json({ status: "error", message: "ดึงรายการธุรกรรมล้มเหลว" });
    }
});

app.get('/api/utils/next-number/:type', async (req, res) => {
    try {
        const { type } = req.params; 
        let prefix = type === 'member' ? 'MEM' : (type === 'receipt' ? 'REC' : 'VOC');
        let table = type === 'member' ? 'members' : (type === 'receipt' ? 'receipts' : 'vouchers');
        let column = type === 'member' ? 'member_code' : (type === 'receipt' ? 'receipt_no' : 'voucher_no');

        const now = new Date();
        const yearMonth = (now.getFullYear() + 543).toString().slice(-2) + (now.getMonth() + 1).toString().padStart(2, '0');
        const pattern = `${prefix}${yearMonth}%`;

        const [rows] = await promisePool.query(`SELECT ${column} FROM ${table} WHERE ${column} LIKE ? ORDER BY ${column} DESC LIMIT 1`, [pattern]);
        
        let nextNum = rows.length > 0 ? parseInt(rows[0][column].slice(-4)) + 1 : 1;
        res.json({ status: "success", next_number: `${prefix}${yearMonth}${nextNum.toString().padStart(4, '0')}` });
    } catch (error) {
        res.status(500).json({ status: "error", message: "รันเลขล้มเหลว" });
    }
});

// [GET] ดึงการตั้งค่าระบบ
app.get('/api/settings', async (req, res) => {
    try {
        const [rows] = await promisePool.query('SELECT * FROM system_settings');
        res.json({ status: "success", data: rows });
    } catch (error) {
        res.status(500).json({ status: "error", message: "ดึงการตั้งค่าล้มเหลว" });
    }
});

// [PUT] อัปเดตการตั้งค่าระบบ
app.put('/api/settings/:key', async (req, res) => {
    try {
        await promisePool.query('UPDATE system_settings SET setting_value = ? WHERE setting_key = ?', [req.body.value, req.params.key]);
        res.json({ status: "success", message: `อัปเดตการตั้งค่าสำเร็จ` });
    } catch (error) {
        res.status(500).json({ status: "error", message: "อัปเดตตั้งค่าล้มเหลว" });
    }
});

// ==========================================
// เริ่มต้นเซิร์ฟเวอร์
// ==========================================
const PORT = 8000;
app.listen(PORT, () => { 
    console.log(`Server is running beautifully on port ${PORT}`); 
});
