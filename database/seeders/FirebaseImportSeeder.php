<?php

namespace Database\Seeders;

use App\Services\AuthService;
use App\Services\CacheService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;

class FirebaseImportSeeder extends Seeder
{
    private string $exportDir;
    private array $baseMap = [];
    private array $categoryMap = [];
    private array $videoMap = [];
    private array $firstVideoByCategory = [];
    private array $productMap = [];

    public function __construct()
    {
        $this->exportDir = base_path('firestore-export');
    }

    public function run(): void
    {
        if (!File::isDirectory($this->exportDir)) {
            $this->command->error('ไม่พบโฟลเดอร์ firestore-export/');
            return;
        }

        $this->command->info('นำเข้าข้อมูล Firebase project cblmodel-6819a...');
        DB::statement('SET FOREIGN_KEY_CHECKS=0');

        try {
            $this->clearImportedTables();
            $this->importUsers();
            $this->importPlaceholderUsers();
            $this->importSources();
            $this->importActivities();
            $this->importProducts();
            $this->importQuizLogsAndCertificates();
            $this->importLearningLogs();
            $this->importPointsTransactions();
            $this->importCheckIns();
            $this->importCouponsAndSpins();
            $this->importNfeHours();
            $this->importProposals();
            $this->importHomeConfig();
            $this->importUpskill();
            $this->importBadgesAndSettings();
        } finally {
            DB::statement('SET FOREIGN_KEY_CHECKS=1');
        }

        $this->call(LocalAdminSeeder::class);
        CacheService::invalidateAll();
        $this->printSummary();
    }

    private function load(string $collection): array
    {
        $file = "{$this->exportDir}/{$collection}.json";
        if (!File::exists($file)) {
            $this->command->warn("ไม่พบ {$collection}.json — ข้าม");
            return [];
        }

        $decoded = json_decode(File::get($file), true);
        if (!is_array($decoded)) {
            throw new \RuntimeException("อ่าน {$collection}.json ไม่สำเร็จ");
        }
        return $decoded;
    }

    private function clearImportedTables(): void
    {
        $tables = [
            'personal_access_tokens', 'user_badges', 'badges', 'certificates',
            'upskill_learning_logs', 'upskill_progress', 'upskill_videos', 'upskill_categories',
            'nfe_hours', 'proposals', 'activity_check_ins', 'source_check_ins',
            'home_featured', 'home_areas', 'quarter_activities', 'activities',
            'spin_transactions', 'points_transactions', 'coupons', 'products',
            'learning_logs', 'quiz_logs', 'quizzes', 'bases', 'sources', 'settings', 'users',
        ];

        foreach ($tables as $table) {
            DB::table($table)->delete();
        }
    }

    private function importUsers(): void
    {
        foreach ($this->load('users') as $doc) {
            $username = $this->username($doc['username'] ?? $doc['phone'] ?? $doc['_id'] ?? '');
            if ($username === '') continue;

            $score = (int) ($doc['score'] ?? 0);
            $role = in_array($doc['role'] ?? '', ['admin', 'teacher', 'user'], true) ? $doc['role'] : 'user';
            $imageStatus = in_array($doc['imageStatus'] ?? '', ['Pending', 'Approved', 'Rejected'], true)
                ? $doc['imageStatus'] : 'Approved';
            $firebaseHash = trim((string) ($doc['passwordHash'] ?? ''));

            DB::table('users')->insert([
                'username' => $username,
                'phone' => $this->phone($doc['phone'] ?? $username),
                'full_name' => trim((string) ($doc['fullName'] ?? $doc['full_name'] ?? '')),
                'password' => $firebaseHash !== '' ? 'sha256$'.strtolower($firebaseHash) : null,
                'role' => $role,
                'tambon' => $this->tambon($doc['tambon'] ?? ''),
                'score' => $score,
                'level' => AuthService::levelFromScore($score),
                'profile_image' => $this->localizeAsset($doc['profileImage'] ?? ''),
                'image_status' => $imageStatus,
                'created_at' => $this->timestamp($doc['createdAt'] ?? null),
                'updated_at' => $this->timestamp($doc['updatedAt'] ?? null),
            ]);
        }
    }

    private function importPlaceholderUsers(): void
    {
        $known = DB::table('users')->pluck('username')->flip()->all();
        $collections = [
            'quizLogs' => 'username', 'learningLogs' => 'username',
            'pointsTransactions' => 'username', 'activityCheckIns' => 'username',
            'sourceCheckIns' => 'username', 'nfeHoursRedemptions' => 'username',
            'upskillLearningLogs' => 'userId', 'upskillProgress' => 'userId',
        ];

        foreach ($collections as $collection => $field) {
            foreach ($this->load($collection) as $doc) {
                $username = $this->username($doc[$field] ?? '');
                if ($username === '' || isset($known[$username])) continue;
                DB::table('users')->insert([
                    'username' => $username,
                    'phone' => $this->phone($username),
                    'full_name' => trim((string) ($doc['fullName'] ?? $username)),
                    'password' => null,
                    'role' => 'user',
                    'tambon' => $this->tambon($doc['tambon'] ?? ''),
                    'score' => 0,
                    'level' => 1,
                    'image_status' => 'Approved',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                $known[$username] = true;
            }
        }
    }

    private function importSources(): void
    {
        $sources = $this->load('sources');
        $baseCounts = [];
        foreach ($sources as $source) {
            foreach ($source['bases'] ?? [] as $base) {
                $id = trim((string) ($base['baseId'] ?? $base['id'] ?? ''));
                if ($id !== '') $baseCounts[$id] = ($baseCounts[$id] ?? 0) + 1;
            }
        }

        foreach ($sources as $source) {
            $sourceId = trim((string) ($source['SourceID'] ?? $source['_id'] ?? ''));
            if ($sourceId === '') continue;
            DB::table('sources')->insert([
                'id' => $sourceId,
                'name' => trim((string) ($source['SourceName'] ?? '')),
                'tambon' => $this->tambon($source['TambonName'] ?? ''),
                'cover_image' => $this->localizeAsset($source['CoverImageURL'] ?? $source['CoverImage'] ?? ''),
                'latitude' => $source['Latitude'] ?? null,
                'longitude' => $source['Longitude'] ?? null,
                'description' => $source['Description'] ?? null,
                'subject_category' => $source['subjectCategory'] ?? null,
                'credit_hours' => (float) ($source['creditHours'] ?? 0),
                'views' => (int) ($source['views'] ?? 0),
                'info' => $this->json($this->localizeRecursive($source['info'] ?? [])),
                'cert_template' => $this->json($this->localizeRecursive($source['certificateTemplate'] ?? null)),
                'cert_template_id' => $source['CertTemplateID'] ?? null,
                'created_at' => $this->timestamp($source['createdAt'] ?? $source['migratedAt'] ?? null),
                'updated_at' => $this->timestamp($source['updatedAt'] ?? null),
            ]);

            foreach (array_values($source['bases'] ?? []) as $baseIndex => $base) {
                $originalId = trim((string) ($base['baseId'] ?? $base['id'] ?? ''));
                if ($originalId === '') continue;
                $baseId = ($baseCounts[$originalId] ?? 0) > 1 ? "{$sourceId}-{$originalId}" : $originalId;
                $baseId = substr($baseId, 0, 20);
                $this->baseMap["{$sourceId}|{$originalId}"] = $baseId;
                DB::table('bases')->insert([
                    'id' => $baseId,
                    'source_id' => $sourceId,
                    'name' => trim((string) ($base['baseName'] ?? $base['name'] ?? '')),
                    'description' => $base['description'] ?? null,
                    'cover_image' => $this->localizeAsset($base['coverImage'] ?? ''),
                    'video_url' => $base['videoUrl'] ?? ($base['info']['videoUrl'] ?? null),
                    'display_order' => (int) ($base['displayOrder'] ?? ($baseIndex + 1)),
                    'is_active' => ($base['isActive'] ?? true) ? 1 : 0,
                    'info' => $this->json($this->localizeRecursive($base['info'] ?? [])),
                    'cert_template' => $this->json($this->localizeRecursive($base['certificateTemplate'] ?? null)),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                foreach (array_values($base['quizzes'] ?? []) as $quizIndex => $quiz) {
                    DB::table('quizzes')->insert([
                        'source_id' => $sourceId,
                        'base_id' => $baseId,
                        'question' => trim((string) ($quiz['question'] ?? '')),
                        'choices' => $this->json(array_values($quiz['choices'] ?? [])),
                        'answer' => strtoupper(trim((string) ($quiz['answer'] ?? ''))),
                        'display_order' => (int) ($quiz['displayOrder'] ?? ($quizIndex + 1)),
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }
            }
        }
    }

    private function importActivities(): void
    {
        foreach ($this->load('activities') as $doc) {
            $id = trim((string) ($doc['activityId'] ?? $doc['_id'] ?? ''));
            if ($id === '') continue;
            DB::table('activities')->insert([
                'id' => $id,
                'name' => trim((string) ($doc['name'] ?? '')),
                'description' => $doc['details'] ?? $doc['description'] ?? null,
                'cover_image' => $this->localizeAsset($doc['coverImage'] ?? $doc['imageUrl'] ?? ''),
                'location' => $doc['location'] ?? null,
                'tambon' => $this->tambon($doc['tambon'] ?? ''),
                'status' => 'Active',
                'is_featured' => ($doc['isFeatured'] ?? false) ? 1 : 0,
                'certificate_template' => $this->json($this->localizeRecursive($doc['certificateTemplate'] ?? null)),
                'quiz_ids' => $this->json($doc['quizzes'] ?? []),
                'check_in_points' => (int) ($doc['checkInPoints'] ?? $doc['points'] ?? 0),
                'quiz_pass_score' => (int) ($doc['quizPassScore'] ?? 60),
                'created_at' => $this->timestamp($doc['createdAt'] ?? null),
                'updated_at' => $this->timestamp($doc['updatedAt'] ?? null),
            ]);
        }
    }

    private function importProducts(): void
    {
        foreach ($this->load('products') as $doc) {
            $externalId = trim((string) ($doc['productId'] ?? $doc['_id'] ?? ''));
            $images = $this->assetList($doc['images'] ?? $doc['image'] ?? $doc['imageUrl'] ?? '');
            $id = DB::table('products')->insertGetId([
                'external_id' => $externalId ?: null,
                'name' => trim((string) ($doc['name'] ?? $doc['productName'] ?? '')),
                'category' => $doc['category'] ?? null,
                'description' => $doc['description'] ?? null,
                'contact' => $doc['contact'] ?? null,
                'tambon' => $this->tambon($doc['tambon'] ?? ''),
                'image_url' => $images[0] ?? null,
                'images' => $this->json($images),
                'cost' => (int) ($doc['cost'] ?? $doc['price'] ?? 0),
                'price' => trim((string) ($doc['price'] ?? $doc['cost'] ?? '')),
                'stock' => (int) ($doc['stock'] ?? -1),
                'is_active' => ($doc['isActive'] ?? true) ? 1 : 0,
                'created_at' => $this->timestamp($doc['createdAt'] ?? null),
                'updated_at' => $this->timestamp($doc['updatedAt'] ?? null),
            ]);
            if ($externalId !== '') $this->productMap[$externalId] = $id;
        }
    }

    private function importQuizLogsAndCertificates(): void
    {
        foreach ($this->load('quizLogs') as $doc) {
            $identity = $this->quizIdentity($doc);
            $username = $identity['username'];
            if ($username === '') continue;
            $externalSourceId = $identity['sourceId'];
            $originalBaseId = $identity['baseId'];
            $sourceId = $externalSourceId !== '' && DB::table('sources')->where('id', $externalSourceId)->exists()
                ? $externalSourceId
                : null;
            $baseId = $sourceId
                ? ($this->baseMap["{$sourceId}|{$originalBaseId}"] ?? ($originalBaseId ?: null))
                : null;
            if ($baseId && !DB::table('bases')->where('id', $baseId)->where('source_id', $sourceId)->exists()) {
                $baseId = null;
            }
            $externalId = trim((string) ($doc['_id'] ?? ''));
            $certUrl = $this->localizeAsset($doc['certUrl'] ?? '');
            DB::table('quiz_logs')->insert([
                'external_id' => $externalId ?: null,
                'external_source_id' => $externalSourceId ?: null,
                'external_base_id' => $originalBaseId ?: null,
                'username' => $username,
                'source_id' => $sourceId ?: null,
                'base_id' => $baseId,
                'score' => $this->quizScore($doc['score'] ?? 0),
                'status' => ($doc['status'] ?? '') === 'Pass' ? 'Pass' : 'Fail',
                'cert_url' => $certUrl ?: null,
                'created_at' => $this->timestamp($doc['createdAt'] ?? $doc['updatedAt'] ?? null),
                'updated_at' => $this->timestamp($doc['updatedAt'] ?? null),
            ]);

            if ($certUrl !== '') {
                $certNo = trim((string) ($doc['refNo'] ?? '')) ?: 'FIREBASE-'.strtoupper(substr(sha1($externalId ?: "{$username}|{$externalSourceId}|{$originalBaseId}"), 0, 12));
                DB::table('certificates')->insertOrIgnore([
                    'username' => $username,
                    'source_id' => $sourceId ?: null,
                    'base_id' => $baseId,
                    'cert_no' => $certNo,
                    'cert_url' => $certUrl,
                    'status' => 'Active',
                    'issued_at' => $this->timestamp($doc['certIssuedAt'] ?? $doc['updatedAt'] ?? null),
                    'created_at' => $this->timestamp($doc['updatedAt'] ?? null),
                    'updated_at' => $this->timestamp($doc['updatedAt'] ?? null),
                ]);
            }
        }

        foreach ($this->load('certificates') as $doc) {
            $username = $this->username($doc['username'] ?? $doc['userId'] ?? '');
            if ($username === '') continue;
            $sourceId = trim((string) ($doc['sourceId'] ?? ''));
            $originalBaseId = trim((string) ($doc['baseId'] ?? ''));
            DB::table('certificates')->insertOrIgnore([
                'username' => $username,
                'source_id' => $sourceId ?: null,
                'base_id' => $this->baseMap["{$sourceId}|{$originalBaseId}"] ?? ($originalBaseId ?: null),
                'activity_id' => $doc['activityId'] ?? null,
                'cert_no' => $doc['certNo'] ?? ('FIREBASE-'.strtoupper(substr(sha1($doc['_id'] ?? uniqid()), 0, 12))),
                'cert_url' => $this->localizeAsset($doc['certUrl'] ?? $doc['url'] ?? ''),
                'status' => ($doc['status'] ?? 'Active') === 'Revoked' ? 'Revoked' : 'Active',
                'issued_at' => $this->timestamp($doc['issuedAt'] ?? $doc['createdAt'] ?? null),
                'created_at' => $this->timestamp($doc['createdAt'] ?? null),
                'updated_at' => $this->timestamp($doc['updatedAt'] ?? null),
            ]);
        }
    }

    private function importLearningLogs(): void
    {
        foreach ($this->load('learningLogs') as $doc) {
            $username = $this->username($doc['username'] ?? $doc['phone'] ?? '');
            if ($username === '') continue;
            $status = in_array($doc['status'] ?? '', ['Pending', 'Approved', 'Rejected'], true) ? $doc['status'] : 'Pending';
            DB::table('learning_logs')->insertOrIgnore([
                'log_id' => $doc['logId'] ?? $doc['_id'] ?? uniqid('log_'),
                'username' => $username,
                'activity_name' => $doc['activityName'] ?? null,
                'description' => $doc['description'] ?? null,
                'external_link' => $doc['externalLink'] ?? null,
                'status' => $status,
                'score' => (float) ($doc['score'] ?? 0),
                'note' => $doc['note'] ?? null,
                'reviewed_at' => $this->nullableTimestamp($doc['reviewedAt'] ?? null),
                'reviewed_by' => $doc['reviewedBy'] ?? null,
                'created_at' => $this->timestamp($doc['createdAt'] ?? null),
                'updated_at' => $this->timestamp($doc['updatedAt'] ?? null),
            ]);
        }
    }

    private function importPointsTransactions(): void
    {
        foreach ($this->load('pointsTransactions') as $doc) {
            $username = $this->username($doc['username'] ?? '');
            if ($username === '') continue;
            DB::table('points_transactions')->insertOrIgnore([
                'external_id' => $doc['txId'] ?? $doc['_id'] ?? null,
                'username' => $username,
                'type' => trim((string) ($doc['type'] ?? 'manual')),
                'description' => $doc['description'] ?? $doc['reason'] ?? null,
                'points' => (int) ($doc['points'] ?? $doc['value'] ?? 0),
                'ref_id' => $doc['refId'] ?? null,
                'created_at' => $this->timestamp($doc['createdAt'] ?? null),
                'updated_at' => $this->timestamp($doc['updatedAt'] ?? null),
            ]);
        }
    }

    private function importCheckIns(): void
    {
        foreach ($this->load('sourceCheckIns') as $doc) {
            $username = $this->username($doc['username'] ?? $doc['phone'] ?? '');
            $sourceId = trim((string) ($doc['sourceId'] ?? ''));
            if ($username === '' || $sourceId === '') continue;
            DB::table('source_check_ins')->updateOrInsert(
                ['username' => $username, 'source_id' => $sourceId],
                ['points' => (int) ($doc['points'] ?? $doc['pointsWon'] ?? 0), 'created_at' => $this->timestamp($doc['createdAt'] ?? $doc['checkedInAt'] ?? null), 'updated_at' => now()]
            );
        }

        foreach ($this->load('activityCheckIns') as $doc) {
            $username = $this->username($doc['username'] ?? '');
            $activityId = trim((string) ($doc['activityId'] ?? ''));
            if ($username === '' || $activityId === '') continue;
            $activityName = DB::table('activities')->where('id', $activityId)->value('name');
            DB::table('activity_check_ins')->updateOrInsert(
                ['username' => $username, 'activity_id' => $activityId],
                [
                    'external_id' => $doc['checkInId'] ?? $doc['_id'] ?? null,
                    'activity_name' => $doc['activityName'] ?? $activityName,
                    'points' => (int) ($doc['totalPointsWon'] ?? $doc['pointsWon'] ?? 0),
                    'scan_points' => (int) ($doc['scanPoints'] ?? $doc['pointsWon'] ?? 0),
                    'quiz_points' => (int) ($doc['quizPointsWon'] ?? $doc['quizPoints'] ?? 0),
                    'quiz_score' => isset($doc['quizScore']) ? (string) $doc['quizScore'] : null,
                    'status' => $doc['status'] ?? null,
                    'created_at' => $this->timestamp($doc['createdAt'] ?? null),
                    'updated_at' => $this->timestamp($doc['updatedAt'] ?? null),
                ]
            );
        }
    }

    private function importCouponsAndSpins(): void
    {
        foreach ($this->load('coupons') as $doc) {
            $username = $this->username($doc['username'] ?? '');
            if ($username === '') continue;
            $externalProduct = trim((string) ($doc['productId'] ?? ''));
            $status = in_array($doc['status'] ?? '', ['Active', 'Used', 'Expired'], true) ? $doc['status'] : 'Active';
            DB::table('coupons')->insertOrIgnore([
                'username' => $username,
                'product_id' => $this->productMap[$externalProduct] ?? null,
                'product_name' => $doc['productName'] ?? $doc['name'] ?? null,
                'code' => $doc['code'] ?? $doc['couponCode'] ?? uniqid('CPN'),
                'cost' => (int) ($doc['cost'] ?? $doc['pointsUsed'] ?? 0),
                'status' => $status,
                'used_at' => $this->nullableTimestamp($doc['usedAt'] ?? null),
                'used_by' => $doc['usedBy'] ?? null,
                'created_at' => $this->timestamp($doc['redeemedAt'] ?? $doc['createdAt'] ?? null),
                'updated_at' => now(),
            ]);
        }

        foreach ($this->load('spinTransactions') as $doc) {
            $username = $this->username($doc['username'] ?? '');
            if ($username === '') continue;
            DB::table('spin_transactions')->insert([
                'username' => $username,
                'points_spent' => (int) ($doc['pointsSpent'] ?? 0),
                'points_won' => (int) ($doc['pointsWon'] ?? $doc['prizeValue'] ?? 0),
                'prize_label' => $doc['prizeLabel'] ?? $doc['prizeName'] ?? null,
                'created_at' => $this->timestamp($doc['createdAt'] ?? $doc['spunAt'] ?? null),
                'updated_at' => now(),
            ]);
        }
    }

    private function importNfeHours(): void
    {
        foreach ($this->load('nfeHoursRedemptions') as $doc) {
            $username = $this->username($doc['username'] ?? '');
            if ($username === '') continue;
            DB::table('nfe_hours')->insert([
                'external_id' => $doc['redemptionId'] ?? $doc['_id'] ?? null,
                'username' => $username,
                'hours' => (float) ($doc['hoursGranted'] ?? $doc['hours'] ?? 0),
                'points_spent' => (int) ($doc['pointsUsed'] ?? $doc['pointsSpent'] ?? 0),
                'status' => ($doc['status'] ?? 'Active') === 'Used' ? 'Used' : 'Active',
                'note' => $doc['note'] ?? null,
                'reviewed_at' => $this->nullableTimestamp($doc['reviewedAt'] ?? null),
                'reviewed_by' => $doc['reviewedBy'] ?? null,
                'created_at' => $this->timestamp($doc['createdAt'] ?? null),
                'updated_at' => $this->timestamp($doc['updatedAt'] ?? null),
            ]);
        }
    }

    private function importProposals(): void
    {
        foreach ($this->load('proposals') as $doc) {
            $username = $this->username($doc['username'] ?? '');
            if ($username === '') continue;
            $status = in_array($doc['status'] ?? '', ['Pending', 'Approved', 'Rejected'], true) ? $doc['status'] : 'Pending';
            DB::table('proposals')->insert([
                'username' => $username,
                'activity_id' => $doc['activityId'] ?? null,
                'title' => $doc['title'] ?? null,
                'description' => $doc['description'] ?? null,
                'status' => $status,
                'note' => $doc['note'] ?? null,
                'reviewed_at' => $this->nullableTimestamp($doc['reviewedAt'] ?? null),
                'reviewed_by' => $doc['reviewedBy'] ?? null,
                'evaluation_data' => $this->json($doc['evaluation'] ?? $doc['evaluationData'] ?? null),
                'survey_data' => $this->json($doc['survey'] ?? $doc['surveyData'] ?? null),
                'created_at' => $this->timestamp($doc['createdAt'] ?? null),
                'updated_at' => $this->timestamp($doc['updatedAt'] ?? null),
            ]);
        }
    }

    private function importHomeConfig(): void
    {
        foreach ($this->load('quarterActivities') as $doc) {
            $id = trim((string) ($doc['activityId'] ?? $doc['_id'] ?? ''));
            if ($id === '') continue;
            DB::table('quarter_activities')->insertOrIgnore([
                'id' => $id,
                'activity_name' => $doc['activityName'] ?? $doc['name'] ?? null,
                'description' => $doc['description'] ?? null,
                'image_url' => $this->localizeAsset($doc['imageUrl'] ?? ''),
                'location_name' => $doc['locationName'] ?? null,
                'tambon' => $this->tambon($doc['tambon'] ?? ''),
                'quarter' => (int) ($doc['quarter'] ?? 1),
                'year' => (int) ($doc['year'] ?? date('Y')),
                'status' => ($doc['status'] ?? 'Active') === 'Inactive' ? 'Inactive' : 'Active',
                'display_order' => (int) ($doc['displayOrder'] ?? 999),
                'created_at' => $this->timestamp($doc['createdAt'] ?? null),
                'updated_at' => $this->timestamp($doc['updatedAt'] ?? null),
            ]);
        }

        foreach ($this->load('homeConfig') as $doc) {
            if (isset($doc['areas'])) {
                DB::table('home_areas')->insert(['areas' => $this->json($doc['areas']), 'created_at' => now(), 'updated_at' => now()]);
            }
            if (($doc['_id'] ?? '') === 'featured' || isset($doc['featuredId'])) {
                DB::table('home_featured')->insert([
                    'featured_id' => $doc['featuredId'] ?? null,
                    'title' => $doc['title'] ?? null,
                    'image_url' => $this->localizeAsset($doc['imageUrl'] ?? ''),
                    'location_name' => $doc['locationName'] ?? null,
                    'map_link' => $doc['mapLink'] ?? null,
                    'start_date' => $doc['startDate'] ?? null,
                    'end_date' => $doc['endDate'] ?? null,
                    'short_desc' => $doc['shortDesc'] ?? null,
                    'is_active' => ($doc['isActive'] ?? true) ? 1 : 0,
                    'created_at' => now(),
                    'updated_at' => $this->timestamp($doc['updatedAt'] ?? null),
                ]);
            }
        }
    }

    private function importUpskill(): void
    {
        foreach ($this->load('upskillCategories') as $index => $doc) {
            $externalId = trim((string) ($doc['_id'] ?? $doc['id'] ?? ''));
            if ($externalId === '') continue;
            $id = DB::table('upskill_categories')->insertGetId([
                'external_id' => $externalId,
                'name' => trim((string) ($doc['label'] ?? $doc['name'] ?? $externalId)),
                'icon' => $doc['icon'] ?? 'fa-video',
                'color' => $doc['color'] ?? '#10b981',
                'description' => $doc['description'] ?? null,
                'image_url' => $this->localizeAsset($doc['imageUrl'] ?? ''),
                'display_order' => (int) ($doc['order'] ?? $doc['displayOrder'] ?? ($index + 1)),
                'is_active' => ($doc['isActive'] ?? true) ? 1 : 0,
                'created_at' => $this->timestamp($doc['createdAt'] ?? null),
                'updated_at' => $this->timestamp($doc['updatedAt'] ?? null),
            ]);
            $this->categoryMap[$externalId] = $id;
        }

        foreach ($this->load('upskillVideos') as $index => $doc) {
            $externalId = trim((string) ($doc['_id'] ?? $doc['id'] ?? ''));
            $categoryExternal = trim((string) ($doc['category'] ?? $doc['categoryId'] ?? ''));
            if ($externalId === '') continue;
            $id = DB::table('upskill_videos')->insertGetId([
                'external_id' => $externalId,
                'category_id' => $this->categoryMap[$categoryExternal] ?? null,
                'title' => trim((string) ($doc['title'] ?? '')),
                'description' => $doc['description'] ?? null,
                'video_url' => $doc['url'] ?? $doc['videoUrl'] ?? '',
                'thumbnail_url' => $this->localizeAsset($doc['thumbnail'] ?? $doc['thumbnailUrl'] ?? ''),
                'duration_seconds' => (int) ($doc['durationSeconds'] ?? 0),
                'display_order' => (int) ($doc['order'] ?? $doc['displayOrder'] ?? ($index + 1)),
                'is_active' => ($doc['isActive'] ?? true) ? 1 : 0,
                'created_at' => $this->timestamp($doc['createdAt'] ?? null),
                'updated_at' => $this->timestamp($doc['updatedAt'] ?? null),
            ]);
            $this->videoMap[$externalId] = $id;
            $this->firstVideoByCategory[$categoryExternal] ??= $id;
        }

        foreach ($this->load('upskillProgress') as $doc) {
            $username = $this->username($doc['userId'] ?? $doc['username'] ?? $doc['_id'] ?? '');
            foreach (($doc['progress'] ?? []) as $categoryExternal => $seconds) {
                $videoId = $this->firstVideoByCategory[(string) $categoryExternal] ?? null;
                if ($username === '' || !$videoId || (int) $seconds <= 0) continue;
                DB::table('upskill_progress')->updateOrInsert(
                    ['username' => $username, 'video_id' => $videoId],
                    ['progress_seconds' => (int) $seconds, 'completed' => 0, 'created_at' => now(), 'updated_at' => $this->timestamp($doc['updatedAt'] ?? null)]
                );
            }
        }

        foreach ($this->load('upskillLearningLogs') as $doc) {
            $username = $this->username($doc['userId'] ?? $doc['username'] ?? '');
            $videoExternal = trim((string) ($doc['videoId'] ?? ''));
            $videoId = $this->videoMap[$videoExternal] ?? null;
            if ($username === '' || !$videoId) continue;
            $categoryExternal = trim((string) ($doc['categoryId'] ?? ''));
            DB::table('upskill_learning_logs')->insert([
                'username' => $username,
                'video_id' => $videoId,
                'video_title' => $doc['videoTitle'] ?? DB::table('upskill_videos')->where('id', $videoId)->value('title'),
                'category_id' => $this->categoryMap[$categoryExternal] ?? null,
                'content' => $doc['notes'] ?? $doc['content'] ?? null,
                'status' => strtolower((string) ($doc['status'] ?? '')) === 'graded' ? 'Approved' : 'Pending',
                'grade' => isset($doc['score']) ? (float) $doc['score'] : null,
                'feedback' => $doc['feedback'] ?? null,
                'graded_at' => $this->nullableTimestamp($doc['gradedAt'] ?? null),
                'graded_by' => $doc['gradedBy'] ?? null,
                'created_at' => $this->timestamp($doc['submittedAt'] ?? $doc['createdAt'] ?? null),
                'updated_at' => $this->timestamp($doc['gradedAt'] ?? $doc['updatedAt'] ?? null),
            ]);
        }
    }

    private function importBadgesAndSettings(): void
    {
        foreach ($this->load('badges') as $doc) {
            $key = trim((string) ($doc['badgeKey'] ?? $doc['_id'] ?? ''));
            if ($key === '') continue;
            DB::table('badges')->insertOrIgnore([
                'badge_key' => $key,
                'name' => $doc['name'] ?? $key,
                'description' => $doc['description'] ?? null,
                'image_url' => $this->localizeAsset($doc['imageUrl'] ?? ''),
                'condition_type' => $doc['conditionType'] ?? null,
                'condition_value' => (int) ($doc['conditionValue'] ?? 0),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        foreach ($this->load('globalSettings') as $doc) {
            $key = trim((string) ($doc['_id'] ?? 'global_settings')) ?: 'global_settings';
            DB::table('settings')->updateOrInsert(
                ['key' => $key],
                ['value' => $this->json($this->localizeRecursive($doc)), 'created_at' => now(), 'updated_at' => now()]
            );
        }
    }

    private function printSummary(): void
    {
        $tables = [
            'users', 'sources', 'bases', 'quizzes', 'quiz_logs', 'learning_logs',
            'activities', 'activity_check_ins', 'products', 'points_transactions',
            'nfe_hours', 'certificates', 'upskill_categories', 'upskill_videos',
            'upskill_progress', 'upskill_learning_logs', 'home_areas', 'home_featured',
        ];
        foreach ($tables as $table) {
            $this->command->line(sprintf('  %-25s %d', $table, DB::table($table)->count()));
        }
        $this->command->info('นำเข้าข้อมูล Firebase เสร็จสิ้น');
    }

    private function username(mixed $value): string
    {
        return mb_strtolower(preg_replace('/\s+/', '', trim((string) $value)));
    }

    private function phone(mixed $value): ?string
    {
        $phone = trim((string) $value);
        return $phone !== '' && mb_strlen($phone) <= 20 ? $phone : null;
    }

    private function tambon(mixed $value): string
    {
        return mb_strtolower(trim((string) $value));
    }

    private function timestamp(mixed $value): string
    {
        return $this->nullableTimestamp($value) ?? now()->format('Y-m-d H:i:s');
    }

    private function nullableTimestamp(mixed $value): ?string
    {
        if (!$value) return null;
        try {
            return (new \DateTime((string) $value))->format('Y-m-d H:i:s');
        } catch (\Throwable) {
            return null;
        }
    }

    private function quizScore(mixed $value): float
    {
        if (is_string($value) && preg_match('/^\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*$/', $value, $matches)) {
            $total = (float) $matches[2];
            return $total > 0 ? round(((float) $matches[1] / $total) * 100, 2) : 0;
        }
        return max(0, min(100, (float) $value));
    }

    private function quizIdentity(array $doc): array
    {
        $username = $this->username($doc['username'] ?? $doc['phone'] ?? '');
        $sourceId = trim((string) ($doc['sourceId'] ?? ''));
        $baseId = trim((string) ($doc['baseId'] ?? ''));

        if (($username === '' || $sourceId === '') && preg_match('/^(.+?)_(SRC[^_]+)_(.+)$/i', (string) ($doc['_id'] ?? ''), $matches)) {
            $username = $username !== '' ? $username : $this->username($matches[1]);
            $sourceId = $sourceId !== '' ? $sourceId : strtoupper($matches[2]);
            if ($baseId === '' && strtolower($matches[3]) !== 'source') {
                $baseId = $matches[3];
            }
        }

        return compact('username', 'sourceId', 'baseId');
    }

    private function json(mixed $value): ?string
    {
        return $value === null ? null : json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    private function assetList(mixed $value): array
    {
        if (is_string($value)) {
            $trimmed = trim($value);
            if ($trimmed === '') return [];
            $decoded = json_decode($trimmed, true);
            $value = is_array($decoded) ? $decoded : [$trimmed];
        }
        if (!is_array($value)) $value = [$value];
        return array_values(array_filter(array_map(fn ($item) => $this->localizeAsset($item), $value)));
    }

    private function localizeRecursive(mixed $value): mixed
    {
        if (is_array($value)) {
            foreach ($value as $key => $item) $value[$key] = $this->localizeRecursive($item);
            return $value;
        }
        return is_string($value) ? $this->localizeAsset($value) : $value;
    }

    private function localizeAsset(mixed $value): string
    {
        $url = trim((string) $value);
        if ($url === '') return '';
        $parts = parse_url(str_replace('&amp;', '&', $url));
        if (($parts['path'] ?? '') !== '/api') return $url;
        parse_str($parts['query'] ?? '', $query);
        if (($query['action'] ?? '') !== 'getFirebaseFile' || empty($query['path'])) return $url;
        $segments = array_map('rawurlencode', explode('/', ltrim((string) $query['path'], '/')));
        return '/storage/firebase/'.implode('/', $segments);
    }
}
