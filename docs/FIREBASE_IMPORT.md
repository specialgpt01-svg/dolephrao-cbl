# Firebase → Laravel/MySQL Import

## ต้นทางและตำแหน่งไฟล์

- Firebase project: `cblmodel-6819a`
- Firestore database: `(default)`, region `asia-southeast1`
- Storage bucket: `cblmodel-6819a-loft-assets`
- โครงการ Firebase ต้นทาง: `C:\Users\Captan America\Desktop\ระบบ\01-Loft-fire base`
- Firestore export ใน Laravel: `firestore-export/`
- Storage assets ใน Laravel: `storage/app/public/firebase/`
- Storage manifest: `storage/app/public/firebase/manifest.json`
- MySQL backup ก่อนนำเข้า: `storage/backups/loft_learn-before-firebase-20260714-141333.sql`

export วันที่ 2026-07-14 มี 22 collections, 297 documents และ Storage 133 ไฟล์ รวม 9,791,740 ไบต์

## Export ใหม่จาก Firebase

รันจากโฟลเดอร์ `functions` ของโครงการ Firebase ต้นทาง:

```powershell
node scripts/export-firestore.js
node scripts/export-firestore-assets.js "C:\Users\Captan America\Desktop\ระบบ\01-Loft-Laravel+mysql-backup\storage\app\public\firebase"
```

จากนั้นคัดลอกเนื้อหา `functions/firestore-export/` มาทับ `firestore-export/` ของ Laravel

## นำเข้า MySQL

สำรองฐาน `loft_learn` ก่อน แล้วรันจากรากโครงการ Laravel:

```powershell
php artisan migrate --force
php artisan db:seed --class=FirebaseImportSeeder --force
```

คำเตือน: `FirebaseImportSeeder` ล้างและสร้างข้อมูลในตารางงานหลักใหม่จาก export, ล้าง token/session เดิม และสร้างบัญชี local admin ใหม่ หลังรันผู้ใช้ทุกคนต้องเข้าสู่ระบบใหม่

## กฎการแปลงข้อมูล

- username ถูก normalize เป็นตัวพิมพ์เล็กและตัดช่องว่าง
- password hash แบบ SHA-256 เดิมเก็บเป็น `sha256$<hash>` และตรวจสอบได้โดย `AuthService`
- บัญชีไม่มี password hash จะยังล็อกอินไม่ได้จนกว่าผู้ดูแลตั้งรหัสผ่านใหม่
- base ID ที่ซ้ำข้าม source เปลี่ยนเป็น `<SOURCE>-<BASE>` เพื่อไม่ชน primary key
- คะแนนข้อความ เช่น `9/10` แปลงเป็นเปอร์เซ็นต์ `90`
- ประวัติที่อ้าง source/base ซึ่งไม่มีอยู่จริงจะไม่สร้างความสัมพันธ์ปลอม แต่เก็บรหัสเดิมใน `external_source_id` และ `external_base_id`
- URL Firebase Storage ถูกเปลี่ยนเป็น `/storage/firebase/...`
- การเช็กอินกิจกรรมซ้ำของผู้ใช้คนเดิมในกิจกรรมเดียวกันรวมเป็นรายการล่าสุด ตาม unique key ของ Laravel
- UpSkill ID แบบข้อความถูก map เป็น numeric ID ของ MySQL และ progress ระดับหมวดถูกผูกกับวิดีโอแรกในหมวดเพื่อรักษาเวลาสะสม

## ผลตรวจหลังนำเข้า

- ผู้ใช้ 112, แหล่งเรียนรู้ 21, ฐาน 35, คำถาม 192
- ประวัติ quiz 28, ประวัติเรียนรู้ 2, กิจกรรม 3, เช็กอินกิจกรรม 23
- สินค้า 15, ธุรกรรมคะแนน 52, ชั่วโมง กพช. 1, ใบประกาศ 9
- UpSkill หมวด 8, วิดีโอ 25, progress 5, learning logs 3
- หน้าแรก: areas 1 record (21 พื้นที่), featured 1
- orphan relationships ที่ตรวจพบหลัง normalize: 0
- Storage manifest: missing 0, size mismatch 0
