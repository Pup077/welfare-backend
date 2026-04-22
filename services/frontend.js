(function attachWelfareApp(window) {
    const BASE_API_URL = 'http://localhost:8000/api';

    class ApiClient {
        constructor(baseUrl = BASE_API_URL) {
            this.baseUrl = baseUrl;
        }

        // รวมการเรียก API ไว้จุดเดียว เพื่อให้ทุกหน้าจัดการ error เหมือนกัน
        async request(path, options = {}) {
            const response = await fetch(`${this.baseUrl}${path}`, {
                headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
                ...options
            });

            const result = await response.json().catch(() => ({}));

            if (!response.ok || result.status === 'error') {
                throw new Error(result.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
            }

            return result;
        }

        get(path) {
            return this.request(path);
        }

        post(path, body) {
            return this.request(path, {
                method: 'POST',
                body: JSON.stringify(body)
            });
        }

        put(path, body) {
            return this.request(path, {
                method: 'PUT',
                body: JSON.stringify(body)
            });
        }
    }

    class SessionManager {
        constructor(storageKey = 'user_session') {
            this.storageKey = storageKey;
        }

        getRawSession() {
            return localStorage.getItem(this.storageKey);
        }

        getUser() {
            const rawSession = this.getRawSession();
            if (!rawSession) {
                return null;
            }

            try {
                return JSON.parse(rawSession);
            } catch (error) {
                this.clear();
                return null;
            }
        }

        saveUser(user) {
            localStorage.setItem(this.storageKey, JSON.stringify(user));
        }

        clear() {
            localStorage.removeItem(this.storageKey);
        }

        requireLogin(redirectUrl = 'index.html') {
            const user = this.getUser();
            if (!user) {
                window.location.href = redirectUrl;
                return null;
            }

            return user;
        }

        requireRole(role, redirectUrl = 'dashboard.html') {
            const user = this.requireLogin();
            if (!user) {
                return null;
            }

            if (user.role !== role) {
                window.alert('คุณไม่มีสิทธิ์เข้าถึงหน้านี้');
                window.location.href = redirectUrl;
                return null;
            }

            return user;
        }
    }

    class AlertBoxController {
        constructor(element) {
            this.element = element;
        }

        hide() {
            this.element.classList.add('hidden');
        }

        show(message, className) {
            this.element.textContent = message;
            this.element.className = className;
            this.element.classList.remove('hidden');
        }

        showSuccess(message) {
            this.show(message, 'mt-4 px-4 py-3 rounded-lg text-sm text-center font-medium bg-green-100 text-green-800');
        }

        showError(message) {
            this.show(message, 'mt-4 px-4 py-3 rounded-lg text-sm text-center font-medium bg-red-100 text-red-700');
        }
    }

    class BasePage {
        constructor() {
            this.api = new ApiClient();
            this.session = new SessionManager();
        }

        getElement(id) {
            return document.getElementById(id);
        }

        withButtonLoading(button, loadingText) {
            const originalText = button.textContent;
            button.textContent = loadingText;
            button.disabled = true;

            return () => {
                button.textContent = originalText;
                button.disabled = false;
            };
        }

        bindLogoutButton(buttonId = 'logoutBtn', redirectUrl = 'index.html') {
            const button = this.getElement(buttonId);
            if (!button) {
                return;
            }

            button.addEventListener('click', () => {
                if (window.confirm('ต้องการออกจากระบบใช่หรือไม่?')) {
                    this.session.clear();
                    window.location.href = redirectUrl;
                }
            });
        }

        setUserDisplay(elementId = 'displayUserName', formatter = null) {
            const user = this.session.getUser();
            const element = this.getElement(elementId);

            if (!user || !element) {
                return;
            }

            element.innerHTML = formatter ? formatter(user) : user.full_name;
        }

        formatCurrency(value) {
            return `${Number(value || 0).toLocaleString()} บาท`;
        }

        formatCount(value) {
            return `${Number(value || 0).toLocaleString()} คน`;
        }
    }

    window.WelfareApp = {
        ApiClient,
        SessionManager,
        AlertBoxController,
        BasePage,
        BASE_API_URL
    };
})(window);
