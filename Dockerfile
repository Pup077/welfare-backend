# Dockerfile นี้บอกวิธีประกอบ backend ให้เป็น container: ติดตั้ง Node dependencies แล้วรัน server.js เป็น API หลัก
# ใช้ Node.js เวอร์ชัน 18 ที่มีขนาดเล็ก (alpine)
FROM node:18-alpine

# ตั้งค่าโฟลเดอร์ทำงานใน Docker
WORKDIR /usr/src/app

# ก๊อปปี้ไฟล์ package.json และติดตั้งเครื่องมือ
COPY package*.json ./
RUN npm install

# ก๊อปปี้โค้ดทั้งหมดของเราเข้าไป
COPY . .

# เปิด Port 8000 ให้ใช้งาน
EXPOSE 8000

# คำสั่งสำหรับรันเซิร์ฟเวอร์
CMD ["node", "server.js"]
