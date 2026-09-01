# คู่มือ Deploy LOFT LEARN บน Shared Hosting (cPanel)

## โครงสร้างไฟล์บน Hosting

```
/home/username/
├── public_html/                ← Document root (web accessible)
│   ├── index.php               ← ชี้ไปที่ loft_app/
│   └── .htaccess               ← URL rewrite
└── loft_app/                   ← Laravel root (ซ่อนจาก web ✅)
    ├── app/
    ├── bootstrap/
    ├── vendor/
    ├── storage/
    ├── .env
    └── artisan
```

---

## Step 1 — อัปโหลดไฟล์

อัปโหลด project ทั้งหมดไปที่ `/home/username/loft_app/`
(ยกเว้น `.git/` และ folder ขนาดใหญ่ที่ไม่จำเป็น)

---

## Step 2 — public_html/index.php

```php
<?php
define("LARAVEL_START", microtime(true));

if (file_exists($maintenance = __DIR__."/../loft_app/storage/framework/maintenance.php")) {
    require $maintenance;
}

require __DIR__."/../loft_app/vendor/autoload.php";
$app = require_once __DIR__."/../loft_app/bootstrap/app.php";

$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
$response = $kernel->handle($request = Illuminate\Http\Request::capture())->send();
$kernel->terminate($request, $response);
```

## Step 3 — .env Production

```env
APP_NAME="LOFT LEARN"
APP_ENV=production
APP_KEY=                        ← php artisan key:generate
APP_DEBUG=false
APP_URL=https://yourdomain.com

LOG_LEVEL=error

DB_CONNECTION=mysql
DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=username_loft
DB_USERNAME=username_loftuser
DB_PASSWORD=YourStrongPassword!

CACHE_STORE=file
CACHE_PREFIX=loft
SESSION_DRIVER=file
QUEUE_CONNECTION=sync
FILESYSTEM_DISK=local
```

## Step 4 — Artisan Commands (SSH/Terminal)

```bash
cd ~/loft_app

php artisan key:generate
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan view:cache
chmod -R 775 storage bootstrap/cache
```

## อัปเดตระบบ

```bash
cd ~/loft_app
php artisan migrate --force       # ถ้ามี migration ใหม่
php artisan config:clear && php artisan config:cache
php artisan route:clear && php artisan route:cache
```

## Cache Strategy (Realtime-First)

ระบบ cache เฉพาะ:
- `global_settings` → 12 ชั่วโมง
- `sources_list` → 30 นาที
- `leaderboard` → 5 นาที

**ไม่ cache**: dashboard, homeData, user-specific data (realtime)

ล้าง cache:
```bash
php artisan cache:clear
# หรือผ่าน API: POST /api { action: "clearCache" } (Admin only)
```
