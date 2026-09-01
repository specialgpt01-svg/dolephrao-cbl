# LOFT LEARN — Laravel + MySQL

ระบบการเรียนรู้ตลอดชีวิต พัฒนาด้วย Laravel 12 และ MySQL/MariaDB โดยหน้าเว็บเดิมเรียก backend ผ่าน Action API ที่ `POST /api`

## ความต้องการของระบบ

- PHP 8.2 ขึ้นไป
- Composer 2
- Node.js 18 ขึ้นไป และ npm (ใช้ build Tailwind CSS)
- MySQL 8 หรือ MariaDB ที่มากับ XAMPP

## เริ่มใช้งานในเครื่อง

```powershell
composer install
npm install
npm run build
Copy-Item .env.example .env
php artisan key:generate
```

สร้างฐานข้อมูล:

```sql
CREATE DATABASE loft_learn CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

ตั้งค่า `.env` ให้ตรงกับ MySQL ในเครื่อง แล้วรัน:

```powershell
php artisan migrate
php artisan storage:link
php artisan db:seed --class=LocalAdminSeeder
php artisan serve --host=127.0.0.1 --port=5000
```

เปิดระบบที่ [http://127.0.0.1:5000](http://127.0.0.1:5000)

บัญชีผู้ดูแลในเครื่องอ่านค่าจากตัวแปรเหล่านี้ใน `.env`:

```env
LOFT_ADMIN_PHONE=1
LOFT_ADMIN_PASSWORD=1
LOFT_ADMIN_NAME="ผู้ดูแลระบบ LOFT"
```

อย่าใช้รหัสผ่านตัวอย่างนี้บนระบบจริง

## โครงสร้างสำคัญ

- `public/` — หน้าเว็บและ JavaScript
- `resources/css/tailwind.css` และ `tailwind.config.cjs` — ต้นทาง Tailwind; สร้างไฟล์ production ด้วย `npm run build`
- `app/Http/Controllers/Api/` — Action API และกฎการทำงาน
- `app/Models/` — Eloquent models
- `database/migrations/` — โครงสร้างฐานข้อมูล
- `routes/api.php` — ตัวเชื่อม action จากหน้าเว็บไปยัง controller

คำสั่งที่เกี่ยวข้องกับข้อมูลผู้ใช้ คะแนน คูปอง ชั่วโมง กพช. และงานผู้ดูแลต้องส่ง token ใน header:

```http
Authorization: Bearer <token>
```

## ตรวจสอบระบบ

```powershell
php artisan migrate:status
php artisan route:list
composer check-platform-reqs
npm run build
```

Health check: [http://127.0.0.1:5000/up](http://127.0.0.1:5000/up)

## ข้อมูลเดิมจาก Firebase

ชุดข้อมูลจาก Firebase project `cblmodel-6819a` ถูก export ไว้ใน `firestore-export/` และไฟล์จาก Storage อยู่ใน `storage/app/public/firebase/` การนำเข้าใหม่ใช้คำสั่ง:

```powershell
php artisan migrate --force
php artisan db:seed --class=FirebaseImportSeeder --force
```

คำสั่ง seeder นี้เป็นการแทนที่ข้อมูลในตารางงานหลักด้วยข้อมูลจาก export แล้วสร้างบัญชีผู้ดูแลในเครื่องใหม่ จึงควรสำรอง MySQL ก่อนรันทุกครั้ง ดูรายละเอียดและจำนวนข้อมูลใน `docs/FIREBASE_IMPORT.md`

รหัสผ่าน Firebase แบบ SHA-256 ที่มีอยู่เดิมรองรับการเข้าสู่ระบบแล้ว ส่วนบัญชีเก่าที่ Firebase ไม่มีค่า password hash ต้องให้ผู้ดูแลตั้งรหัสผ่านใหม่ก่อนจึงจะเข้าสู่ระบบได้

## การนำขึ้นระบบจริง

ตั้ง `APP_ENV=production`, `APP_DEBUG=false`, `APP_URL` และข้อมูลฐานข้อมูลจริง จากนั้นรัน `php artisan migrate --force` บนเซิร์ฟเวอร์ อย่าอัปโหลด `.env` ของเครื่องพัฒนา และให้ document root ชี้ไปที่โฟลเดอร์ `public/` ของโครงการนี้
