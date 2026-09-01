# LOFT Laravel — Handoff 2026-07-14

## สถานะปัจจุบัน

- โครงการทำงานที่ `C:\Users\Captan America\Desktop\ระบบ\01-Loft-Laravel+mysql-backup`
- URL ในเครื่อง: `http://127.0.0.1:5000/`
- Health check: `http://127.0.0.1:5000/up`
- ฐานข้อมูลที่ใช้: `loft_learn` บน MySQL/MariaDB ของ XAMPP พอร์ต 3306
- ฐาน `pta` เดิมไม่ได้ถูกแก้ไข
- บัญชีผู้ดูแลในเครื่อง: `1` / `1` (ใช้บัญชี Firebase เดิมและเก็บชื่อ พื้นที่ คะแนน และประวัติไว้)
- นำ Firestore จาก project `cblmodel-6819a` เข้า MySQL แล้ว รวม 297 เอกสารต้นทาง
- ดาวน์โหลด Firebase Storage bucket `cblmodel-6819a-loft-assets` ครบ 133 ไฟล์ (9,791,740 ไบต์) มาไว้ใน `storage/app/public/firebase`
- export ต้นฉบับอยู่ใน `firestore-export/`; manifest ไฟล์อยู่ที่ `storage/app/public/firebase/manifest.json`

## สิ่งที่แก้แล้ว

- แก้ Laravel entrypoint, BOM และ public storage junction
- ปรับ Composer ให้รองรับ PHP 8.2 และติดตั้ง dependency ที่เข้ากันได้
- เพิ่ม Sanctum token table และบังคับ Bearer token ในคำสั่งส่วนตัว/ผู้ดูแล
- เพิ่ม action ของ learning log ที่ frontend เรียกแต่ backend เดิมไม่มี
- แก้สัญญา API ของ source detail, quiz, activity, proposal, NFE, UpSkill และ certificate
- ป้องกันคะแนน quiz/activity ถูกเพิ่มซ้ำ
- ทำ transaction สำหรับคะแนน, เช็กอิน, แลกชั่วโมง, วงล้อ และแลกคูปอง
- สร้าง PDF ใบประกาศจริงและเก็บใน public storage
- เพิ่ม LocalAdminSeeder และแก้ README ให้ตรงกับวิธีรันปัจจุบัน
- เพิ่ม `FirebaseImportSeeder` สำหรับนำเข้าผู้ใช้ แหล่งเรียนรู้ ฐาน แบบทดสอบ ประวัติ กิจกรรม สินค้า คะแนน ชั่วโมง กพช. หน้าแรก และ UpSkill
- รองรับรหัสผ่าน SHA-256 เดิมจาก Firebase จำนวน 47 บัญชี
- แยกรหัสฐานที่ซ้ำข้ามแหล่งเรียนรู้ และเก็บรหัส source/base ต้นทางของประวัติแบบทดสอบไว้ใน `external_source_id` / `external_base_id`
- แปลงคะแนนแบบ `9/10` เป็น 90% และเปลี่ยน URL ไฟล์ Firebase ให้ชี้ไฟล์ local
- ล้าง application cache อัตโนมัติหลังนำเข้าข้อมูล
- ถอด Tailwind Play CDN และเพิ่ม Tailwind CLI 3.4.17; ไฟล์ production อยู่ที่ `public/assets/tailwind.css`
- เปลี่ยนรูป placeholder ภายนอกเป็น `public/assets/placeholder-image.svg`
- ป้องกัน frontend ฟื้น session เก่าที่ไม่มี Bearer token และล้างสถานะอัตโนมัติเมื่อ API ตอบ 401
- ปิด Sanctum `statefulApi()` เพราะ frontend ใช้ Personal Access Token; แก้ same-origin POST จากเบราว์เซอร์ที่เคยติด CSRF 419
- กำหนด unauthenticated `/api/*` ให้ตอบ JSON 401 เสมอแทนการ redirect ไป named route `login` ที่ไม่มีอยู่
- แก้ contract ตลาดชุมชนให้รองรับ `productId`, `price`, `image` และ `images` ตามที่ frontend เดิมเรียก พร้อมเก็บราคาต้นฉบับจาก Firebase ครบ 15 รายการ
- แก้ภาพรวมให้ส่ง `totalLearners` และ `ranking` และแก้สถิติผู้ดูแลให้ส่งจำนวนสมาชิก/ผู้เรียนจากข้อมูลจริง
- หน้า “จัดการสมาชิก” เปิดมาที่ “ทั้งหมด” และแสดงสมาชิกทุกบทบาทสำหรับผู้ดูแล
- แก้ PHP development server บน Windows ที่ทำค่าตำบลภาษาไทยใน GET query เสีย โดยเข้ารหัส UTF-8 เป็น Base64 ที่ frontend และถอดรหัสใน action API
- ปรับ “ระบบจัดการข้อมูล” เป็นศูนย์จัดการระดับเดียว 5 หมวด 19 งาน ได้แก่ ภาพรวม/สมาชิก, เนื้อหา/หลักสูตร, กิจกรรม/ประเมินผล, ตลาด/คูปอง และตั้งค่าระบบ
- ถอดเมนูแท็บซ้ำออกจากหน้าหลังบ้าน หน้าตรวจงาน และหน้าจัดการสมาชิก; ทุกการ์ดจากศูนย์จัดการเปิดเฉพาะ workspace ของงานนั้นและมีปุ่มกลับศูนย์จัดการ
- แยกสมาชิก/อนุมัติรูป/ประวัติใบเกียรติบัตร, งานตรวจ 4 ประเภท และวิดีโอ/หมวดหมู่อัพสกิลเป็นทางเข้าตรง ไม่ซ้อนอยู่ในเมนูรวม
- เอารายชื่อผู้เรียนที่ซ้ำกับหน้าจัดการสมาชิกออกจากรายงานภาพรวม และแก้ชื่อกราฟเป็น “จำนวนสมาชิกแยกตามพื้นที่”
- แยก “กิจกรรมเด่นหน้าแรก” ออกจาก “กิจกรรมรายไตรมาส (21 พื้นที่)” เป็นสองทางเข้าและสองโหมดการทำงาน; เปิดโหมดใดจะซ่อนอีกส่วน และหัว workspace รองรับข้อความไทยหลายบรรทัดโดยไม่ใช้ ellipsis
- แก้ `getHomeSummary` ให้ส่งโปรไฟล์ผู้ใช้ แต้ม ชั่วโมง กพช. คูปอง แหล่งเรียนรู้แนะนำ และงานรอดำเนินการตาม contract หน้าแรก; บัญชี `1` แสดง 60 แต้มและ กพช. 10 ชั่วโมงจาก Firebase
- แก้ `getUserBadges` ให้คำนวณเหรียญ 8 รายการจากประวัติ quiz/กิจกรรม/คูปอง/วงล้อ/แต้ม พร้อมส่งทั้ง `badges` และ `data`; frontend รองรับข้อมูลเก่าและกำหนดค่าเริ่มต้นป้องกันฟิลด์เหรียญไม่ครบ
- คืนข้อมูลที่ถูกเปลี่ยนระหว่างการทดสอบ API ให้ตรง export Firebase: ลบรายการหมุนวงล้อทดสอบ 2 รายการ คืนคะแนนบัญชี `1` จาก 75 เป็น 60 และคืนรายการ `NFE-1781431102230` เป็น `Active` 10 ชั่วโมง

## จำนวนข้อมูลหลังนำเข้า Firebase

| ตาราง | จำนวน |
|---|---:|
| users | 111 |
| sources / bases / quizzes | 21 / 35 / 192 |
| quiz_logs / learning_logs | 28 / 2 |
| activities / activity_check_ins | 3 / 23 |
| products / points_transactions | 15 / 52 |
| nfe_hours / certificates | 1 / 9 |
| upskill_categories / upskill_videos | 8 / 25 |
| upskill_progress / upskill_learning_logs | 5 / 3 |
| home_areas / home_featured | 1 / 1 |

ผู้ใช้ 111 รายประกอบด้วย Firebase 104 รายและผู้ใช้ placeholder สำหรับประวัติเก่า 7 ราย บัญชี Firebase หมายเลข `1` เป็นผู้ดูแล local (`1` / `1`) โดยยังเก็บโปรไฟล์ คะแนน และพื้นที่เดิมไว้ การเช็กอินกิจกรรม 30 เอกสารต้นทางรวมเป็น 23 คู่ผู้ใช้/กิจกรรมตามข้อกำหนด unique ของระบบ โดยเก็บรายการล่าสุดของแต่ละคู่

บัญชี Firebase 47 รายมี password hash เดิมและเข้าสู่ระบบได้ด้วยรหัสเดิม อีก 57 บัญชี Firebase รวมถึง placeholder 7 รายไม่มี password hash จึงต้องตั้งรหัสผ่านใหม่ก่อนเข้าใช้

## การตรวจสอบล่าสุด

```powershell
php artisan migrate:status
php artisan route:list
composer check-platform-reqs --no-dev
php artisan serve --host=127.0.0.1 --port=5000
```

- PHP syntax: 75 ไฟล์ผ่าน
- JavaScript syntax: 13 ไฟล์ผ่าน
- `/` และ `/up`: HTTP 200
- ทดสอบ API จริงผ่าน: login/token, source/base/quiz, ป้องกันแต้มซ้ำ, activity check-in/quiz, learning log, UpSkill progress/grade, NFE redeem/use/report, lucky wheel, logout/revoke token
- PDF certificate: HTTP 200, content type `application/pdf`
- Firebase API หลังนำเข้า: sources 21, products 15, activities 3, UpSkill categories 8, videos 25, NFE report 1
- ตลาดชุมชน: สินค้า 15 รายการผ่าน contract `productId`/`price`/`image` ครบทั้ง 15 รายการ
- ภาพรวม: ผู้เรียน 89 ราย, ranking 10 ราย; สถิติผู้ดูแล: สมาชิกทั้งหมด 111 ราย, ผู้เรียน 89 ราย
- จัดการสมาชิก: ตัวกรอง “ทั้งหมด” พบ 111 ราย; ตัวกรอง “โหล่งขอด” พบ 3 ราย และ “เวียง” พบ 8 ราย
- โครงสร้างศูนย์จัดการ: 5 หมวด 19 การ์ด, admin workspace ที่ผู้ใช้เห็น 8 งาน, approval workspace 4 งาน และไม่พบแถบเมนูหลังบ้านซ้ำใน `admin.html` / `user-mgmt.html`
- ไฟล์หน้า `/`, `admin.html`, `user-mgmt.html`, `app.js` และ `style.css` ตอบ HTTP 200 หลังปรับโครงสร้าง
- หน้าแรกอ่าน featured เดิมชื่อ `ปฐมนิเทศนักศึกษาใหม่` และพื้นที่ 21 รายการ
- API หน้าแรกบัญชี `1`: โปรไฟล์สำเร็จ, คะแนน 60, กพช. 10 ชั่วโมง, แหล่งเรียนรู้แนะนำ 4 รายการ
- API เหรียญบัญชี `1`: สำเร็จ 8 รายการ, ฟิลด์ `id`/`description`/`currentValue`/`targetValue`/`unlocked` ครบ และเหรียญผ่านแบบทดสอบรายการแรกปลดล็อกแล้ว
- ความสัมพันธ์ quiz/user/source/base, activity/user และ UpSkill user/video ไม่มี orphan
- Firebase Storage manifest 133 รายการ: ไม่พบไฟล์หายและขนาดไม่ตรง 0 รายการ
- `npm run build` ผ่าน, dependency audit พบช่องโหว่ 0 รายการ
- JavaScript syntax 13 ไฟล์ผ่าน และหน้า `/` โหลด compiled Tailwind/placeholder local ด้วย HTTP 200

## หมายเหตุ Git และการสำรอง

- checkout นี้มีสถานะ Git เปลี่ยนแปลงและไฟล์ untracked จำนวนมากตั้งแต่ก่อนเริ่มงาน จึงไม่ได้ stage, commit หรือย้อนการแก้ไขเดิม
- ไม่ได้ deploy ขึ้นระบบภายนอก
- สำรองฐาน `loft_learn` ก่อนนำเข้า Firebase ไว้ที่ `storage/backups/loft_learn-before-firebase-20260714-141333.sql`
- ฐาน `pta` เดิมไม่ได้ถูกแก้ไข
- วิธี export/import ซ้ำและข้อควรระวังอยู่ใน `docs/FIREBASE_IMPORT.md`
