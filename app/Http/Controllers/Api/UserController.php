<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\QuizLog;
use App\Models\LearningLog;
use App\Models\Coupon;
use App\Models\PointsTransaction;
use App\Models\Source;
use App\Models\SourceCheckIn;
use App\Models\ActivityCheckIn;
use App\Models\UpskillLearningLog;
use App\Models\Certificate;
use App\Models\Activity;
use App\Models\Base;
use App\Models\NfeHour;
use App\Services\AuthService;
use App\Services\CacheService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserController extends Controller
{
    /**
     * getUserProfile
     */
    public function getProfile(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        $username = $actor['username'] ?? '';
        if (!$username) {
            return response()->json(['status' => 'error', 'message' => 'กรุณาเข้าสู่ระบบ'], 401);
        }

        $user = User::where('username', $username)->first();
        if (!$user) {
            return response()->json(null);
        }

        $profileData = $user->toProfileArray();
        $profileData['nfeHours'] = (float) NfeHour::where('username', $user->username)
            ->where('status', 'Active')
            ->sum('hours');

        CacheService::forgetUserProfile($username);

        return response()->json(['status' => 'success', 'profile' => $profileData, 'user' => $profileData]);
    }

    /**
     * getLeaderboard — Top 10 users by score (รองรับการกรองตามสถานศึกษา)
     */
    public function getLeaderboard(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        $instId = trim($request->input('institutionId') ?? $request->input('institution_id') ?? '');
        if (!$instId && $actor && ($actor['institution_id'] ?? '') !== 'ALL' && !empty($actor['institution_id'])) {
            $instId = $actor['institution_id'];
        }

        $data = CacheService::getLeaderboard(function () use ($instId) {
            $query = User::where('role', 'user');
            if ($instId && $instId !== 'ALL' && $instId !== 'ทั้งหมด') {
                $query->where('institution_id', $instId);
            }
            return $query->orderByDesc('score')
                ->limit(10)
                ->get()
                ->map(fn($u) => [
                    'name'             => $u->getDisplayName(),
                    'fullName'         => $u->full_name,
                    'nickname'         => $u->nickname ?? '',
                    'nicknameUnlocked' => (bool) $u->nickname_unlocked,
                    'phone'            => $u->phone,
                    'tambon'           => $u->tambon,
                    'institutionId'    => $u->institution_id,
                    'image'            => ($u->image_status !== 'Rejected' && !empty($u->profile_image)) ? $u->profile_image : '',
                    'level'            => $u->level,
                    'score'            => (int) $u->score,
                    'imageStatus'      => $u->image_status,
                    'cosmetics'        => $u->cosmetics ?? ['owned' => [], 'equipped' => ['frame' => '', 'name_glow' => '', 'badge' => '']],
                ])
                ->toArray();
        }, $instId ?: 'ALL');

        return response()->json($data);
    }

    /**
     * getUsersByTambon — admin/teacher ดูรายชื่อผู้เรียนในพื้นที่
     */
    public function getUsersByTambon(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor || !in_array($actor['role'], ['admin', 'teacher'])) {
            return response()->json([]);
        }

        $query = User::query();

        $institutionId = trim($request->input('institutionId') ?? $request->input('institution_id') ?? '');
        if (!AuthService::isSuperAdmin($actor)) {
            $institutionId = $actor['institution_id'] ?? 'INS_PHRAO';
        }
        if ($institutionId && $institutionId !== 'ALL' && $institutionId !== 'ทั้งหมด') {
            $query->where('institution_id', $institutionId);
        }

        if ($actor['role'] === 'teacher') {
            $rawTambon = $actor['tambon'];
            $clean = AuthService::normalizeTambon($rawTambon);
            $query->where(function($q) use ($rawTambon, $clean) {
                if ($rawTambon) {
                    $q->where('tambon', $rawTambon);
                }
                if ($clean !== '' && $clean !== 'all') {
                    $q->orWhere('tambon', 'LIKE', '%' . $clean . '%');
                }
            });
        } else {
            $inputTambon = trim((string) ($request->input('tambon') ?? ''));
            $clean = AuthService::normalizeTambon($inputTambon);
            if ($inputTambon && !in_array($inputTambon, ['all', 'ทั้งหมด'], true) && $clean !== 'all' && $clean !== '') {
                $query->where(function($q) use ($inputTambon, $clean) {
                    $q->where('tambon', $inputTambon)
                      ->orWhere('tambon', 'LIKE', '%' . $clean . '%');
                });
            }
        }

        $users = $query->orderByDesc('score')->get()->map(fn($u) => [
            'username'     => $u->username,
            'phone'        => $u->phone,
            'fullName'     => $u->full_name,
            'profileImage' => $u->profile_image,
            'level'        => $u->level,
            'score'        => (int) $u->score,
            'role'         => $u->role,
            'tambon'       => $u->tambon,
            'userCategory' => $u->user_category ?? 'ประชาชนทั่วไป',
            'ageGroup'     => $u->age_group ?? '',
            'occupation'   => $u->occupation ?? '',
            'imageStatus'  => $u->image_status,
        ]);

        return response()->json($users);
    }

    /**
     * getEPortfolio — สมุดสะสมการเรียนรู้
     */
    public function getEPortfolio(Request $request): JsonResponse
    {
        $targetUsername = AuthService::normalizeUsername(
            $request->input('targetUsername') ?? $request->input('targetPhone') ??
            $request->input('username') ?? $request->input('phone') ?? ''
        );
        $actor = AuthService::buildActorFromRequest($request);

        if (!$targetUsername) {
            return response()->json(['status' => 'error', 'message' => 'ไม่พบผู้เรียน']);
        }

        $user = User::where('username', $targetUsername)->first();
        if (!$user) {
            return response()->json(['status' => 'error', 'message' => 'ไม่พบข้อมูลผู้เรียน']);
        }

        $actorId   = $actor ? $actor['username'] : null;
        $actorRole = $actor ? $actor['role'] : '';
        $isOwner   = $actorId && $actorId === $targetUsername;
        $canView   = in_array($actorRole, ['admin', 'teacher']) || $isOwner || true;

        // 1. Quizzes (Both Pass and Fail or attempts)
        $quizLogs = QuizLog::where('username', $targetUsername)
            ->orderByDesc('created_at')
            ->get();

        $sourceIds = $quizLogs->pluck('source_id')->filter()->unique()->values();
        $activityIds = $quizLogs->pluck('activity_id')->filter()->unique()->values();
        $baseIds = $quizLogs->pluck('base_id')->filter()->unique()->values();

        $sources = Source::whereIn('id', $sourceIds)->get()->keyBy('id');
        $activities = Activity::whereIn('id', $activityIds)->get()->keyBy('id');
        $bases = Base::whereIn('id', $baseIds)->get()->keyBy('id');

        // Also fetch Certificates to link with quiz logs
        $userCerts = Certificate::where('username', $targetUsername)
            ->where('status', '!=', 'Revoked')
            ->get();

        // Helper to format clean Tambon
        $cleanTambon = function(?string $raw) {
            if (!$raw) return '';
            $t = preg_replace('/^(ศกร\.ระดับตำบล|ศกร\.ตำบล|ตำบล|ต\.)\s*/u', '', trim($raw));
            $t = preg_replace('/^(ศกร\.ระดับ|ศกร\.)\s*/u', '', $t);
            return $t ? 'ศกร.ตำบล' . $t : '';
        };

        $quizzes = $quizLogs->map(function($q) use ($sources, $activities, $bases, $userCerts, $cleanTambon) {
            $src = $q->source_id ? ($sources[$q->source_id] ?? null) : null;
            $act = $q->activity_id ? ($activities[$q->activity_id] ?? null) : null;
            $base = $q->base_id ? ($bases[$q->base_id] ?? null) : null;

            // Determine Title, Category & Location
            $title = '';
            $category = '';
            $location = '';
            $tambon = '';
            
            if ($src) {
                $title = $src->name;
                $category = 'แหล่งเรียนรู้ ม.6';
                $tambon = $cleanTambon($src->tambon);
                $location = ($tambon ? $tambon . ' • ' : '') . ($src->institution ?? 'สกร.ระดับอำเภอพร้าว');
            } elseif ($act) {
                $title = $act->name ?? $act->title ?? 'กิจกรรมสถานศึกษา';
                $category = 'กิจกรรมสถานศึกษา';
                $tambon = $cleanTambon($act->tambon);
                $location = ($tambon ? $tambon . ' • ' : '') . ($act->location ?? 'สกร.ระดับอำเภอพร้าว');
            } elseif ($base) {
                $baseParentSrc = $base->source_id ? ($sources[$base->source_id] ?? null) : null;
                $title = $base->name ? ($baseParentSrc ? $baseParentSrc->name . ' (' . $base->name . ')' : $base->name) : 'ฐานการเรียนรู้';
                $category = 'ฐานการเรียนรู้';
                $location = 'สกร.ระดับอำเภอพร้าว';
            } else {
                $title = 'แบบทดสอบประเมินความรู้';
                $category = 'แบบทดสอบออนไลน์';
                $location = 'สกร.ระดับอำเภอพร้าว';
            }

            // Find associated certificate if passed
            $matchedCert = $userCerts->first(function($c) use ($q) {
                if ($q->source_id && $c->source_id === $q->source_id) return true;
                if ($q->activity_id && $c->activity_id === $q->activity_id) return true;
                return false;
            });

            $status = $q->status ?? ($q->score >= 80 ? 'Pass' : 'Fail');
            $isPass = strtolower((string)$status) === 'pass' || (int)$q->score >= 80;

            return [
                'id'            => $q->id,
                'sourceId'      => $q->source_id,
                'activityId'    => $q->activity_id,
                'baseId'        => $q->base_id ?? '',
                'title'         => $title,
                'sourceName'    => $title,
                'category'      => $category,
                'location'      => $location,
                'tambon'        => $tambon,
                'score'         => (int) $q->score,
                'status'        => $isPass ? 'Pass' : 'Fail',
                'isPass'        => $isPass,
                'certNo'        => $matchedCert?->cert_no ?? null,
                'certUrl'       => $matchedCert?->cert_url ?? $q->cert_url ?? null,
                'date'          => $q->created_at?->format('d/m/Y H:i') ?? '—',
                'rawDate'       => $q->created_at,
            ];
        })->toArray();

        // 2. Check-in Logs (Sources and Activities)
        $sourceCheckIns = SourceCheckIn::where('username', $targetUsername)
            ->orderByDesc('created_at')
            ->get();
        $sCheckInSourceIds = $sourceCheckIns->pluck('source_id')->unique()->filter()->values();
        $sNames = Source::whereIn('id', $sCheckInSourceIds)->pluck('name', 'id');

        $activityCheckIns = ActivityCheckIn::where('username', $targetUsername)
            ->orderByDesc('created_at')
            ->get();

        $checkins = [];
        foreach ($sourceCheckIns as $sc) {
            $checkins[] = [
                'type'         => 'แหล่งเรียนรู้ ม.6',
                'name'         => $sNames[$sc->source_id] ?? ('แหล่งเรียนรู้ ' . $sc->source_id),
                'pointsEarned' => (int) $sc->points,
                'date'         => $sc->created_at?->format('d/m/Y H:i') ?? '—',
                'rawDate'      => $sc->created_at,
            ];
        }
        foreach ($activityCheckIns as $ac) {
            $checkins[] = [
                'type'         => 'กิจกรรมสถานศึกษา',
                'name'         => $ac->activity_name ?? ('กิจกรรม ' . $ac->activity_id),
                'pointsEarned' => (int) $ac->points,
                'date'         => $ac->created_at?->format('d/m/Y H:i') ?? '—',
                'rawDate'      => $ac->created_at,
            ];
        }
        // Sort checkins by date desc
        usort($checkins, function($a, $b) {
            return ($b['rawDate'] <=> $a['rawDate']);
        });

        // 3. Learning Logs (Approved portfolio items)
        $logs = LearningLog::where('username', $targetUsername)
            ->orderByDesc('created_at')
            ->get()
            ->map(fn($l) => [
                'logId'        => $l->log_id,
                'activityName' => $l->activity_name,
                'description'  => $l->description,
                'score'        => (float) $l->score,
                'status'       => $l->status,
                'note'         => $l->note ?? '',
                'date'         => $l->created_at?->format('d/m/Y H:i') ?? '—',
            ])->toArray();

        // 4. Upskill Videos Logs
        $upskills = UpskillLearningLog::where('username', $targetUsername)
            ->orderByDesc('created_at')
            ->get()
            ->map(fn($u) => [
                'videoTitle' => $u->video_title ?? 'วิดีโออัพสกิล',
                'grade'      => $u->grade,
                'status'     => $u->status,
                'feedback'   => $u->feedback,
                'date'       => $u->created_at?->format('d/m/Y H:i') ?? '—',
            ])->toArray();

        // 5. Points History / Transactions
        $pointsHistory = PointsTransaction::where('username', $targetUsername)
            ->orderByDesc('created_at')
            ->limit(50)
            ->get()
            ->map(fn($pt) => [
                'description' => $pt->description ?? $pt->type ?? 'กิจกรรมสะสมแต้ม',
                'type'        => $pt->type,
                'points'      => (int) $pt->points,
                'date'        => $pt->created_at?->format('d/m/Y H:i') ?? '—',
            ])->toArray();

        // 6. Certificates
        $cSourceIds = $userCerts->pluck('source_id')->filter()->unique()->values();
        $cActIds = $userCerts->pluck('activity_id')->filter()->unique()->values();
        $cSources = Source::whereIn('id', $cSourceIds)->get()->keyBy('id');
        $cActs = Activity::whereIn('id', $cActIds)->get()->keyBy('id');

        $certificates = $userCerts->map(function($c) use ($cSources, $cActs) {
            $src = $c->source_id ? ($cSources[$c->source_id] ?? null) : null;
            $act = $c->activity_id ? ($cActs[$c->activity_id] ?? null) : null;
            $title = $src?->name ?? $act?->name ?? 'ใบประกาศนียบัตร';
            $category = $src ? 'แหล่งเรียนรู้ ม.6' : ($act ? 'กิจกรรมสถานศึกษา' : 'หลักสูตรทั่วไป');
            $tambon = $src?->tambon ?? $act?->tambon ?? '';

            return [
                'id'         => $c->id,
                'certNo'     => $c->cert_no,
                'title'      => $title,
                'sourceName' => $title,
                'category'   => $category,
                'tambon'     => $tambon ? 'ตำบล' . str_replace(['ต.', 'ตำบล', 'ศกร.ระดับตำบล', 'ศกร.ตำบล'], '', $tambon) : 'อำเภอพร้าว',
                'sourceId'   => $c->source_id,
                'activityId' => $c->activity_id,
                'certUrl'    => $c->cert_url,
                'issuedAt'   => $c->issued_at?->format('d/m/Y') ?? $c->created_at?->format('d/m/Y') ?? '—',
            ];
        })->toArray();

        // Summary Stats
        $passedQuizzes = count(array_filter($quizzes, fn($q) => strtolower($q['status']) === 'pass'));
        $stats = [
            'totalScore'        => (int) ($user->score ?? 0),
            'quizzesCount'      => count($quizzes),
            'passedQuizzes'     => $passedQuizzes,
            'checkInsCount'     => count($checkins),
            'certificatesCount' => count($certificates),
            'upskillsCount'     => count($upskills),
            'nfeHours'          => (int) ($user->nfe_hours ?? 0),
        ];

        return response()->json([
            'status'        => 'success',
            'profile'       => $user->toProfileArray(),
            'stats'         => $stats,
            'quizzes'       => $quizzes,
            'checkins'      => $checkins,
            'logs'          => $logs,
            'upskills'      => $upskills,
            'pointsHistory' => $pointsHistory,
            'certificates'  => $certificates,
        ]);
    }

    /**
     * deleteUser — admin/teacher ลบผู้ใช้
     */
    public function deleteUser(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor || !in_array($actor['role'], ['admin', 'teacher'])) {
            return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์']);
        }

        $targetUserId = AuthService::normalizeUsername(
            $request->input('targetUserId') ?? $request->input('targetUsername') ??
            $request->input('phone') ?? $request->input('username') ??
            $request->input('targetPhone') ?? ''
        );
        if (!$targetUserId) {
            return response()->json(['status' => 'error', 'message' => 'กรุณาระบุรหัสผู้ใช้เป้าหมาย']);
        }

        $user = User::where('username', $targetUserId)->first();
        if (!$user) {
            return response()->json(['status' => 'error', 'message' => 'ไม่พบผู้ใช้']);
        }

        if ($actor['role'] === 'teacher') {
            if (AuthService::normalizeTambon($user->tambon) !== AuthService::normalizeTambon($actor['tambon'])) {
                return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์ลบผู้ใช้นอกพื้นที่']);
            }
        }

        // Cascade delete จะจัดการ related records อัตโนมัติ (via FK ON DELETE CASCADE)
        $user->delete();

        CacheService::invalidateLeaderboard();

        return response()->json(['status' => 'success']);
    }

    /**
     * updateUserDetails — admin/teacher แก้ไขข้อมูลผู้ใช้
     */
    public function updateUserDetails(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor) {
            return response()->json(['status' => 'error', 'message' => 'กรุณาเข้าสู่ระบบก่อนดำเนินการ']);
        }

        $targetUserId  = AuthService::normalizeUsername(
            $request->input('targetUserId') ?? $request->input('targetUsername') ??
            $request->input('targetPhone') ?? $request->input('phone') ??
            $request->input('username') ?? $actor['username'] ?? ''
        );
        $fullName      = trim($request->input('fullName') ?? $request->input('full_name') ?? '');
        $profileImage  = $request->input('profileImage') ?? $request->input('profile_image') ?? $request->input('avatar') ?? $request->input('image');
        $requestedRole = $request->has('role') ? strtolower(trim($request->input('role') ?? '')) : null;

        if (!$targetUserId) {
            return response()->json(['status' => 'error', 'message' => 'กรุณาระบุรหัสผู้ใช้เป้าหมาย']);
        }

        // หากไม่ได้แก้ไขตัวเอง ต้องตรวจสอบสิทธิ์ Admin / Teacher
        if ($actor['username'] !== $targetUserId && !in_array($actor['role'], ['admin', 'teacher'])) {
            return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์แก้ไขข้อมูลผู้อื่น']);
        }

        $user = User::where('username', $targetUserId)->first();
        if (!$user) {
            return response()->json(['status' => 'error', 'message' => 'ไม่พบผู้ใช้']);
        }

        if ($actor['role'] === 'teacher' && $actor['username'] !== $targetUserId) {
            if (AuthService::normalizeTambon($user->tambon) !== AuthService::normalizeTambon($actor['tambon'])) {
                return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์แก้ไขผู้ใช้นอกพื้นที่']);
            }
        }

        $updates = [];
        if ($fullName) $updates['full_name'] = $fullName;
        if ($profileImage !== null) {
            $savedImage = $this->saveBase64ImageFile($profileImage, 'profile_' . $targetUserId);
            $updates['profile_image'] = $savedImage;
            $updates['image_status']  = 'Approved';
        }
        if ($request->has('tambon') && trim($request->input('tambon'))) {
            $updates['tambon'] = AuthService::normalizeTambon($request->input('tambon'));
        }
        if ($request->has('userCategory')) {
            $updates['user_category'] = trim($request->input('userCategory') ?? 'ประชาชนทั่วไป');
        }
        if ($request->has('ageGroup')) {
            $updates['age_group'] = trim($request->input('ageGroup') ?? '');
        }
        if ($request->has('occupation')) {
            $updates['occupation'] = trim($request->input('occupation') ?? '');
        }
        if ($requestedRole !== null) {
            if (!in_array($requestedRole, ['admin', 'teacher', 'user'])) {
                return response()->json(['status' => 'error', 'message' => 'สิทธิ์ผู้ใช้ไม่ถูกต้อง']);
            }
            if ($actor['role'] !== 'admin') {
                return response()->json(['status' => 'error', 'message' => 'เฉพาะผู้ดูแลระบบเท่านั้นที่เปลี่ยนสิทธิ์ได้']);
            }
            if ($actor['username'] === $targetUserId && $requestedRole !== 'admin') {
                return response()->json(['status' => 'error', 'message' => 'ไม่สามารถลดสิทธิ์ผู้ดูแลระบบของตัวเองได้']);
            }
            $updates['role'] = $requestedRole;
        }

        $user->update($updates);

        CacheService::forgetUserProfile($targetUserId);
        CacheService::invalidateLeaderboard();

        return response()->json([
            'status'       => 'success',
            'profileImage' => $user->profile_image ?? '',
            'message'      => 'บันทึกข้อมูลเรียบร้อยแล้ว'
        ]);
    }

    /**
     * createUserByAdmin — admin สร้างผู้ใช้ใหม่ในระบบ (ตามบทบาทที่ระบุ)
     */
    public function createUserByAdmin(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor || $actor['role'] !== 'admin') {
            return response()->json(['status' => 'error', 'message' => 'เฉพาะผู้ดูแลระบบเท่านั้นที่สามารถสร้างสมาชิกใหม่ได้']);
        }

        $data         = $request->all();
        $username     = AuthService::normalizeUsername($data['username'] ?? $data['phone'] ?? '');
        $phone        = trim($data['phone'] ?? $username);
        $fullName     = trim($data['fullName'] ?? $data['full_name'] ?? '');
        $password     = $data['password'] ?? '';
        $tambon       = AuthService::normalizeTambon($data['tambon'] ?? '');
        $role         = strtolower(trim($data['role'] ?? 'user'));
        $userCategory = trim($data['userCategory'] ?? 'ประชาชนทั่วไป');
        $ageGroup     = trim($data['ageGroup'] ?? '');
        $occupation   = trim($data['occupation'] ?? '');

        if (!$username) {
            return response()->json(['status' => 'error', 'message' => 'กรุณากรอกชื่อผู้ใช้หรือเบอร์โทรศัพท์']);
        }
        if (!$fullName) {
            return response()->json(['status' => 'error', 'message' => 'กรุณากรอกชื่อ-นามสกุล']);
        }
        if (!$tambon) {
            return response()->json(['status' => 'error', 'message' => 'กรุณาระบุพื้นที่/ตำบล']);
        }
        if (!$password || strlen($password) < 6) {
            return response()->json(['status' => 'error', 'message' => 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร']);
        }
        if (!in_array($role, ['admin', 'teacher', 'user'], true)) {
            return response()->json(['status' => 'error', 'message' => 'ประเภทสิทธิ์สมาชิกไม่ถูกต้อง']);
        }

        if (User::where('username', $username)->exists()) {
            return response()->json(['status' => 'error', 'message' => 'เบอร์โทรศัพท์/ชื่อผู้ใช้นี้มีในระบบแล้ว']);
        }

        $user = User::create([
            'username'      => $username,
            'phone'         => $phone,
            'full_name'     => $fullName,
            'password'      => AuthService::hashPassword($password),
            'role'          => $role,
            'tambon'        => $tambon,
            'user_category' => $userCategory,
            'age_group'     => $ageGroup,
            'occupation'    => $occupation,
            'score'         => 0,
            'level'         => 1,
        ]);

        CacheService::invalidateLeaderboard();

        return response()->json(['status' => 'success', 'user' => $user->toProfileArray()]);
    }

    /**
     * approveProfileImage
     */
    public function approveProfileImage(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor || !in_array($actor['role'], ['admin', 'teacher'])) {
            return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์']);
        }

        $targetUserId = AuthService::normalizeUsername(
            $request->input('targetUserId') ?? $request->input('targetUsername') ??
            $request->input('phone') ?? $request->input('username') ??
            $request->input('targetPhone') ?? ''
        );
        $rawStatus = $request->input('status') ?? ($request->input('action') === 'rejectAvatar' ? 'Rejected' : 'Approved');
        $status    = in_array($rawStatus, ['Approved', 'Rejected', 'Pending']) ? $rawStatus : 'Approved';

        if (!$targetUserId) {
            return response()->json(['status' => 'error', 'message' => 'กรุณาระบุรหัสผู้ใช้เป้าหมาย']);
        }

        $user = User::where('username', $targetUserId)->first();
        if (!$user) {
            return response()->json(['status' => 'error', 'message' => 'ไม่พบผู้ใช้']);
        }

        if ($actor['role'] === 'teacher') {
            if (AuthService::normalizeTambon($user->tambon) !== AuthService::normalizeTambon($actor['tambon'])) {
                return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์จัดการผู้ใช้นอกพื้นที่']);
            }
        }

        $user->update(['image_status' => $status]);
        return response()->json(['status' => 'success']);
    }

    /**
     * getAdminLearnerDetail — รายละเอียดผู้เรียนสำหรับ admin
     */
    public function getAdminLearnerDetail(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor || !in_array($actor['role'], ['admin', 'teacher'])) {
            return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์เข้าถึงข้อมูลผู้เรียน']);
        }

        $uid = AuthService::normalizeUsername(
            $request->input('targetUsername') ?? $request->input('targetPhone') ??
            $request->input('username') ?? $request->input('phone') ?? ''
        );
        if (!$uid) {
            return response()->json(['status' => 'error', 'message' => 'ไม่พบรหัสผู้เรียน']);
        }

        $user = User::where('username', $uid)->first();
        if (!$user) return response()->json(['status' => 'error', 'message' => 'ไม่พบข้อมูลผู้เรียน']);

        if ($actor['role'] === 'teacher') {
            if (AuthService::normalizeTambon($user->tambon) !== AuthService::normalizeTambon($actor['tambon'])) {
                return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์ดูข้อมูลผู้เรียนนอกพื้นที่']);
            }
        }

        $quizzes      = QuizLog::where('username', $uid)->orderByDesc('updated_at')->get();
        $learningLogs = LearningLog::where('username', $uid)->orderByDesc('created_at')->get();
        $coupons      = Coupon::where('username', $uid)->orderByDesc('created_at')->get();
        $points       = PointsTransaction::where('username', $uid)->orderByDesc('created_at')->get();
        $sourceCI     = SourceCheckIn::where('username', $uid)->orderByDesc('created_at')->get();
        $activityCI   = ActivityCheckIn::where('username', $uid)->orderByDesc('created_at')->get();
        $nfe          = NfeHour::where('username', $uid)->orderByDesc('created_at')->get();

        return response()->json([
            'status'  => 'success',
            'profile' => $user->toProfileArray(),
            'summary' => [
                'quizCount'      => $quizzes->count(),
                'passedQuizCount' => $quizzes->where('status', 'Pass')->count(),
                'certCount'      => $quizzes->whereNotNull('cert_url')->count(),
                'logCount'       => $learningLogs->count(),
                'couponCount'    => $coupons->count(),
                'checkInCount'   => $sourceCI->count() + $activityCI->count(),
                'nfeHours'       => $nfe->sum('hours'),
            ],
            'quizzes'          => $quizzes->map(fn($q) => [
                'id' => $q->id, 'sourceId' => $q->source_id, 'baseId' => $q->base_id,
                'score' => $q->score, 'status' => $q->status, 'certUrl' => $q->cert_url,
                'date' => $q->updated_at?->format('d/m/Y'),
            ])->values(),
            'learningLogs'     => $learningLogs->map(fn($l) => [
                'id' => $l->id, 'activityName' => $l->activity_name, 'status' => $l->status,
                'score' => $l->score, 'note' => $l->note, 'date' => $l->updated_at?->format('d/m/Y'),
            ])->values(),
            'coupons'          => $coupons->map(fn($c) => [
                'id' => $c->id, 'productName' => $c->product_name, 'code' => $c->code,
                'cost' => $c->cost, 'status' => $c->status, 'date' => $c->updated_at?->format('d/m/Y'),
            ])->values(),
            'points'           => $points->map(fn($p) => [
                'id' => $p->id, 'type' => $p->type, 'description' => $p->description,
                'points' => $p->points, 'date' => $p->created_at?->format('d/m/Y'),
            ])->values(),
            'sourceCheckIns'   => $sourceCI->map(fn($s) => [
                'id' => $s->id, 'sourceId' => $s->source_id, 'points' => $s->points,
                'date' => $s->created_at?->format('d/m/Y'),
            ])->values(),
            'activityCheckIns' => $activityCI->map(fn($a) => [
                'id' => $a->id, 'activityId' => $a->activity_id, 'activityName' => $a->activity_name,
                'points' => $a->points, 'date' => $a->created_at?->format('d/m/Y'),
            ])->values(),
            'nfe'              => $nfe->map(fn($n) => [
                'id' => $n->id, 'hours' => $n->hours, 'pointsSpent' => $n->points_spent,
                'status' => $n->status, 'note' => $n->note, 'date' => $n->created_at?->format('d/m/Y'),
            ])->values(),
        ]);
    }

    /**
     * resetUserPasswordByAdmin — แอดมิน/ครูรีเซ็ตรหัสผ่านของผู้ใช้
     * Admin: กดได้ทุกคน
     * Teacher: ครูกดได้เฉพาะผู้เรียน (role === 'user') ในพื้นที่ตัวเองเท่านั้น
     */
    public function resetUserPasswordByAdmin(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor || !in_array($actor['role'], ['admin', 'teacher'])) {
            return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์']);
        }

        $targetUserId  = AuthService::normalizeUsername($request->input('targetUserId') ?? $request->input('username') ?? '');
        $newPassword   = trim($request->input('newPassword') ?? $request->input('password') ?? '123456');

        if (!$targetUserId) {
            return response()->json(['status' => 'error', 'message' => 'กรุณาระบุสมาชิกที่ต้องการรีเซ็ตรหัสผ่าน']);
        }
        if (!$newPassword || strlen($newPassword) < 6) {
            return response()->json(['status' => 'error', 'message' => 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร']);
        }

        $user = User::where('username', $targetUserId)->first();
        if (!$user) {
            return response()->json(['status' => 'error', 'message' => 'ไม่พบข้อมูลสมาชิกในระบบ']);
        }

        // ตรวจสอบสิทธิ์ Teacher
        if ($actor['role'] === 'teacher') {
            if ($user->role !== 'user') {
                return response()->json(['status' => 'error', 'message' => 'ครูมีสิทธิ์รีเซ็ตรหัสผ่านได้เฉพาะผู้เรียนทั่วไปเท่านั้น']);
            }
            if (AuthService::normalizeTambon($user->tambon) !== AuthService::normalizeTambon($actor['tambon'])) {
                return response()->json(['status' => 'error', 'message' => 'ครูไม่มีสิทธิ์รีเซ็ตรหัสผ่านของผู้เรียนนอกพื้นที่']);
            }
        }

        // บันทิกรหัสผ่านใหม่ พร้อมตั้งค่า must_change_password = true
        $user->update([
            'password'                => AuthService::hashPassword($newPassword),
            'must_change_password'    => true,
            'password_reset_required' => true,
        ]);

        return response()->json([
            'status'      => 'success',
            'message'     => 'รีเซ็ตรหัสผ่านสำเร็จ สมาชิกจะต้องเปลี่ยนรหัสผ่านใหม่เมื่อเข้าสู่ระบบครั้งถัดไป',
            'newPassword' => $newPassword,
        ]);
    }

    /**
     * forceChangePassword — ผู้ใช้เปลี่ยนรหัสผ่านใหม่เมื่อถูกบังคับเปลี่ยน
     */
    public function forceChangePassword(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor) {
            return response()->json(['status' => 'error', 'message' => 'กรุณาเข้าสู่ระบบ']);
        }

        $user = User::where('username', $actor['username'])->first();
        if (!$user) {
            return response()->json(['status' => 'error', 'message' => 'ไม่พบผู้ใช้']);
        }

        $newPassword     = trim($request->input('newPassword') ?? $request->input('password') ?? '');
        $confirmPassword = trim($request->input('confirmPassword') ?? $request->input('confirm_password') ?? '');

        if (!$newPassword || strlen($newPassword) < 6) {
            return response()->json(['status' => 'error', 'message' => 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร']);
        }
        if ($confirmPassword && $newPassword !== $confirmPassword) {
            return response()->json(['status' => 'error', 'message' => 'รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน']);
        }

        $user->update([
            'password'                => AuthService::hashPassword($newPassword),
            'must_change_password'    => false,
            'password_reset_required' => false,
        ]);

        return response()->json([
            'status'  => 'success',
            'message' => 'ตั้งรหัสผ่านใหม่สำเร็จ สามารถใช้งานระบบได้ตามปกติ',
            'user'    => $user->toProfileArray(),
        ]);
    }

    /**
     * updateNickname — อัปเดตฉายาสำหรับแสดงผลในหน้าอันดับ (ต้องแลกบัตรปลดล็อกก่อน)
     */
    public function updateNickname(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        $username = $actor['username'] ?? '';
        if (!$username) {
            return response()->json(['status' => 'error', 'message' => 'กรุณาเข้าสู่ระบบ'], 401);
        }

        $user = User::where('username', $username)->first();
        if (!$user) {
            return response()->json(['status' => 'error', 'message' => 'ไม่พบผู้ใช้งาน'], 404);
        }

        $isStaff = in_array($user->role, ['admin', 'teacher']);
        if (!$user->nickname_unlocked && !$isStaff) {
            return response()->json(['status' => 'error', 'message' => 'คุณต้องใช้แต้มแลกซื้อบัตรปลดล็อกการตั้งฉายาก่อน']);
        }

        $nickname = trim((string) ($request->input('nickname') ?? $request->input('title') ?? ''));
        if (mb_strlen($nickname) > 50) {
            return response()->json(['status' => 'error', 'message' => 'ฉายาต้องไม่เกิน 50 ตัวอักษร']);
        }

        $user->nickname = $nickname;
        $user->save();

        CacheService::forgetUserProfile($username);
        CacheService::invalidateLeaderboard($username);

        return response()->json([
            'status'      => 'success',
            'message'     => $nickname !== '' ? 'บันทึกฉายาหน้าอันดับสำเร็จแล้ว!' : 'ยกเลิกฉายา กลับไปใช้ชื่อจริงบนหน้าอันดับแล้ว',
            'nickname'    => $user->nickname,
            'displayName' => $user->getDisplayName(),
            'profile'     => $user->toProfileArray(),
        ]);
    }

    /**
     * adjustUserScore — Super Admin / Admin เพิ่ม, ลด หรือกำหนดคะแนนให้ผู้เรียน
     */
    public function adjustUserScore(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor || $actor['role'] !== 'admin') {
            return response()->json(['status' => 'error', 'message' => 'คุณไม่มีสิทธิ์ในการปรับคะแนนสมาชิก (สำหรับผู้ดูแลระบบเท่านั้น)'], 403);
        }

        $targetUserId = AuthService::normalizeUsername(
            $request->input('targetUserId') ?? $request->input('targetUsername') ??
            $request->input('username') ?? $request->input('phone') ?? ''
        );

        if (!$targetUserId) {
            return response()->json(['status' => 'error', 'message' => 'กรุณาระบุสมาชิกที่ต้องการปรับคะแนน']);
        }

        $user = User::where('username', $targetUserId)->first();
        if (!$user) {
            return response()->json(['status' => 'error', 'message' => 'ไม่พบข้อมูลสมาชิกในระบบ'], 404);
        }

        // ตรวจสอบสิทธิ์กรณีไม่ใช่ Super Admin ให้แก้ได้เฉพาะในสังกัดตนเอง
        if (!AuthService::isSuperAdmin($actor)) {
            $actorInst = $actor['institution_id'] ?? 'INS_PHRAO';
            if (!empty($actorInst) && $actorInst !== 'ALL' && $actorInst !== 'ทั้งหมด' && $user->institution_id !== $actorInst) {
                return response()->json(['status' => 'error', 'message' => 'คุณไม่มีสิทธิ์ปรับคะแนนผู้เรียนนอกสถานศึกษาของตนเอง'], 403);
            }
        }

        $mode = strtolower(trim((string) ($request->input('mode') ?? 'add'))); // 'add', 'deduct', 'set'
        $points = (int) ($request->input('points') ?? $request->input('amount') ?? 0);
        $reason = trim((string) ($request->input('reason') ?? $request->input('description') ?? $request->input('note') ?? ''));

        $oldScore = (int) $user->score;

        if ($mode === 'set') {
            $newScore = max(0, $points);
            $delta = $newScore - $oldScore;
        } elseif ($mode === 'deduct') {
            $deductAmount = abs($points);
            if ($deductAmount <= 0) {
                return response()->json(['status' => 'error', 'message' => 'กรุณาระบุจำนวนแต้มที่ต้องการหักออก']);
            }
            $newScore = max(0, $oldScore - $deductAmount);
            $delta = $newScore - $oldScore; // negative value
        } else { // default 'add'
            $addAmount = abs($points);
            if ($addAmount <= 0) {
                return response()->json(['status' => 'error', 'message' => 'กรุณาระบุจำนวนแต้มที่ต้องการเพิ่ม']);
            }
            $newScore = $oldScore + $addAmount;
            $delta = $addAmount;
        }

        $newLevel = AuthService::levelFromScore($newScore);

        $user->update([
            'score' => $newScore,
            'level' => $newLevel,
        ]);

        $defaultDescription = $delta >= 0 
            ? "ปรับเพิ่มคะแนนโดยผู้ดูแลระบบ (+{$delta} แต้ม)"
            : "ปรับลดคะแนนโดยผู้ดูแลระบบ ({$delta} แต้ม)";

        PointsTransaction::create([
            'username'    => $user->username,
            'type'        => 'admin_adjustment',
            'points'      => $delta,
            'description' => $reason !== '' ? $reason : $defaultDescription,
        ]);

        CacheService::forgetUserProfile($user->username);
        CacheService::invalidateLeaderboard($user->username);

        $actionWord = $delta > 0 ? "เพิ่มคะแนน +{$delta} แต้ม" : ($delta < 0 ? "หักคะแนน {$delta} แต้ม" : "อัปเดตคะแนน");

        return response()->json([
            'status'         => 'success',
            'message'        => "{$actionWord} ให้กับ {$user->getDisplayName()} เรียบร้อยแล้ว (คะแนนสะสมใหม่: {$newScore} แต้ม)",
            'oldScore'       => $oldScore,
            'newScore'       => $newScore,
            'delta'          => $delta,
            'newLevel'       => $newLevel,
            'user'           => $user->toProfileArray(),
        ]);
    }

    /**
     * getUserPointsHistory — ดึงประวัติรายการเคลื่อนไหวแต้มสะสม
     */
    public function getUserPointsHistory(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor) {
            return response()->json(['status' => 'error', 'message' => 'กรุณาเข้าสู่ระบบ'], 401);
        }

        $targetUserId = AuthService::normalizeUsername(
            $request->input('targetUserId') ?? $request->input('targetUsername') ??
            $request->input('username') ?? $request->input('phone') ?? $actor['username']
        );

        if ($targetUserId !== $actor['username'] && !in_array($actor['role'], ['admin', 'teacher'])) {
            return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์ดูประวัติคะแนนของผู้อื่น'], 403);
        }

        $items = PointsTransaction::where('username', $targetUserId)
            ->orderByDesc('created_at')
            ->limit(100)
            ->get()
            ->map(fn($t) => [
                'id'          => $t->id,
                'type'        => $t->type,
                'points'      => (int) $t->points,
                'description' => $t->description ?? '',
                'refId'       => $t->ref_id,
                'date'        => $t->created_at ? $t->created_at->format('d/m/Y H:i') : '—',
                'rawDate'     => $t->created_at,
            ]);

        $user = User::where('username', $targetUserId)->first();

        return response()->json([
            'status'       => 'success',
            'username'     => $targetUserId,
            'currentScore' => $user ? (int) $user->score : 0,
            'currentLevel' => $user ? (int) $user->level : 1,
            'transactions' => $items,
        ]);
    }

    /**
     * Helper to automatically convert base64 image data URLs into stored files
     */
    protected function saveBase64ImageFile(?string $dataUrl, string $prefix = 'profile'): string
    {
        if (empty($dataUrl)) return '';
        $dataUrl = trim($dataUrl);

        if (preg_match('/^data:image\/(\w+);base64,/', $dataUrl, $matches)) {
            $ext = strtolower($matches[1]);
            if ($ext === 'jpeg') $ext = 'jpg';
            if (!in_array($ext, ['jpg', 'png', 'gif', 'webp', 'svg'])) $ext = 'jpg';

            $data = base64_decode(substr($dataUrl, strpos($dataUrl, ',') + 1));
            if ($data && strlen($data) <= 15 * 1024 * 1024) {
                $filename = $prefix . '_' . time() . '_' . \Illuminate\Support\Str::random(6) . '.' . $ext;
                $dir = 'uploads/images/' . date('Y/m');
                \Illuminate\Support\Facades\Storage::disk('public')->put($dir . '/' . $filename, $data);
                return '/storage/' . $dir . '/' . $filename;
            }
        } elseif (strlen($dataUrl) > 1000 && !str_starts_with($dataUrl, 'http') && !str_starts_with($dataUrl, '/storage/')) {
            $data = base64_decode($dataUrl);
            if ($data && strlen($data) <= 15 * 1024 * 1024) {
                $filename = $prefix . '_' . time() . '_' . \Illuminate\Support\Str::random(6) . '.jpg';
                $dir = 'uploads/images/' . date('Y/m');
                \Illuminate\Support\Facades\Storage::disk('public')->put($dir . '/' . $filename, $data);
                return '/storage/' . $dir . '/' . $filename;
            }
        }

        return $dataUrl;
    }
}

