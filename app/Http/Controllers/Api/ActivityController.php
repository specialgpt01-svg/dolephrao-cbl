<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Activity;
use App\Models\QuarterActivity;
use App\Models\Coupon;
use App\Models\LearningLog;
use App\Models\NfeHour;
use App\Models\Proposal;
use App\Models\Source;
use App\Models\Base;
use App\Models\SourceCheckIn;
use App\Models\ActivityCheckIn;
use App\Models\ActivityEvaluation;
use App\Models\Certificate;
use App\Models\Institution;
use App\Models\PointsTransaction;
use App\Models\Quiz;
use App\Models\QuizLog;
use App\Models\User;
use App\Services\AuthService;
use App\Services\CacheService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use PhpOffice\PhpWord\PhpWord;
use PhpOffice\PhpWord\Style\Font;
use PhpOffice\PhpWord\Style\Table;
use PhpOffice\PhpWord\Style\Language;
use PhpOffice\PhpWord\ComplexType\ProofState;
use PhpOffice\PhpWord\IOFactory;
use PhpOffice\PhpWord\SimpleType\Jc;
use PhpOffice\PhpWord\SimpleType\JcTable;
use PhpOffice\PhpWord\Shared\Converter;

class ActivityController extends Controller
{

    /** getHomeData — ข้อมูลหน้าหลัก (Realtime — ไม่ cache) */
    public function getHomeData(Request $request): JsonResponse
    {
        $quarter = (int) ($request->input('quarter') ?? 1);
        $year    = (int) ($request->input('year') ?? now()->year);
        $page    = (int) ($request->input('page') ?? 1);
        $limit   = (int) ($request->input('limit') ?? 50);

        $actor = AuthService::buildActorFromRequest($request);
        $instId = trim($request->input('institutionId') ?? $request->input('institution_id') ?? '');

        if ($actor && in_array($actor['role'], ['admin', 'teacher']) && !AuthService::isSuperAdmin($actor) && !empty($actor['institution_id'])) {
            $instId = $actor['institution_id'];
        }

        $featuredQuery = \App\Models\HomeFeatured::where('is_active', true);
        $areasQuery    = \App\Models\HomeArea::query();
        $activitiesQuery = QuarterActivity::where('quarter', $quarter)
            ->where('year', $year)
            ->where('status', 'Active');

        if ($instId && $instId !== 'ALL' && $instId !== 'ทั้งหมด') {
            $featuredQuery->where('institution_id', $instId);
            $areasQuery->where('institution_id', $instId);
            $activitiesQuery->where('institution_id', $instId);
        }

        $featured = $featuredQuery->latest()->first();
        $areas    = $areasQuery->latest()->first()?->areas ?? [];
        $activities = $activitiesQuery->orderBy('display_order')->paginate($limit, ['*'], 'page', $page);

        $activitiesMapped = collect($activities->items())->map(fn($qa) => $this->quarterActivityToFrontend($qa))->all();

        return response()->json([
            'status'     => 'success',
            'featured'   => $featured ? [
                'title'        => $featured->title,
                'imageUrl'     => $featured->image_url,
                'locationName' => $featured->location_name,
                'mapLink'      => $featured->map_link,
                'startDate'    => $featured->start_date,
                'endDate'      => $featured->end_date,
                'shortDesc'    => $featured->short_desc,
            ] : null,
            'areas'      => $areas,
            'activities' => $activitiesMapped,
            'total'      => $activities->total(),
            'page'       => $page,
        ]);
    }

    /** getHomeSummary */
    public function getHomeSummary(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        $profile = null;
        $nfe = [
            'totalHours' => 0,
            'usedThisYear' => 0,
            'remainingThisYear' => 50,
            'maxPerYear' => 50,
        ];
        $couponCount = 0;
        $staffTasks = null;

        if ($actor) {
            $user = User::where('username', $actor['username'])->first();
            if ($user) {
                $profile = $user->toProfileArray();
                $profile['image'] = $user->image_status === 'Approved'
                    ? ($user->profile_image ?? '')
                    : '';

                $nfeQuery = NfeHour::where('username', $user->username);
                $usedThisYear = (float) (clone $nfeQuery)
                    ->whereYear('created_at', now()->year)
                    ->sum('hours');
                $totalActive = (float) (clone $nfeQuery)
                    ->where('status', 'Active')
                    ->sum('hours');
                $nfe = [
                    'totalHours' => $totalActive,
                    'usedThisYear' => $usedThisYear,
                    'remainingThisYear' => max(0, 50 - $usedThisYear),
                    'maxPerYear' => 50,
                ];

                $couponCount = Coupon::where('username', $user->username)
                    ->whereRaw('LOWER(status) <> ?', ['cancelled'])
                    ->count();
            }

            if (in_array($actor['role'], ['admin', 'teacher'], true)) {
                $pendingLogs = LearningLog::whereRaw('LOWER(status) = ?', ['pending']);
                $pendingImages = User::whereRaw('LOWER(image_status) = ?', ['pending']);
                $pendingProposals = Proposal::whereRaw('LOWER(status) = ?', ['pending']);

                if ($actor['role'] === 'teacher') {
                    $tambon = AuthService::normalizeTambon($actor['tambon'] ?? '');
                    $pendingLogs->whereHas('user', fn ($query) => $query->where('tambon', $tambon));
                    $pendingImages->where('tambon', $tambon);
                    $pendingProposals->whereHas('user', fn ($query) => $query->where('tambon', $tambon));
                }

                $staffTasks = [
                    'pendingLogs' => $pendingLogs->count(),
                    'pendingImages' => $pendingImages->count(),
                    'pendingProposals' => $pendingProposals->count(),
                ];
            }
        }

        $recommendedSources = Source::orderByDesc('views')
            ->orderBy('name')
            ->limit(4)
            ->get()
            ->map(fn (Source $source) => [
                'sourceId' => $source->id,
                'name' => $source->name,
                'tambon' => $source->tambon,
                'image' => $source->cover_image ?? '',
                'creditHours' => (float) $source->credit_hours,
            ])
            ->values();

        return response()->json([
            'status' => 'success',
            'profile' => $profile,
            'nfe' => $nfe,
            'couponCount' => $couponCount,
            'recommendedSources' => $recommendedSources,
            'staffTasks' => $staffTasks,
        ]);
    }

    public function getAdminHomeData(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor || !in_array($actor['role'], ['admin', 'teacher'])) {
            return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์']);
        }

        $quarter = (int) ($request->input('quarter') ?? 1);
        $year    = (int) ($request->input('year') ?? now()->year);

        $actor = AuthService::buildActorFromRequest($request);
        $instId = trim($request->input('institutionId') ?? $request->input('institution_id') ?? $actor['institution_id'] ?? 'INS_PHRAO');

        if (!AuthService::isSuperAdmin($actor)) {
            $instId = $actor['institution_id'] ?? 'INS_PHRAO';
        }

        $featuredQuery = \App\Models\HomeFeatured::where('is_active', true);
        $areasQuery    = \App\Models\HomeArea::query();
        $activitiesQuery = \App\Models\QuarterActivity::where('quarter', $quarter)->where('year', $year);

        if ($instId && $instId !== 'ALL' && $instId !== 'ทั้งหมด') {
            $featuredQuery->where('institution_id', $instId);
            $areasQuery->where('institution_id', $instId);
            $activitiesQuery->where('institution_id', $instId);
        }

        $featured = $featuredQuery->latest()->first();
        $areas    = $areasQuery->latest()->first()?->areas ?? [];
        $activities = $activitiesQuery->orderBy('display_order')->get();

        $activitiesMapped = $activities->map(fn($qa) => $this->quarterActivityToFrontend($qa))->all();

        return response()->json([
            'status'          => 'success',
            'featured'        => $featured ? [
                'featuredId'   => $featured->featured_id,
                'title'        => $featured->title,
                'imageUrl'     => $featured->image_url,
                'locationName' => $featured->location_name,
                'mapLink'      => $featured->map_link,
                'startDate'    => $featured->start_date,
                'endDate'      => $featured->end_date,
                'shortDesc'    => $featured->short_desc,
            ] : null,
            'areas'           => $areas,
            'activitiesAdmin' => $activitiesMapped,
        ]);
    }

    private function saveBase64ImageFile(?string $dataUrl, string $prefix = 'act'): string
    {
        if (!$dataUrl) return '';
        $dataUrl = trim($dataUrl);
        if (preg_match('/^data:image\/(\w+);base64,/', $dataUrl, $matches)) {
            $ext = strtolower($matches[1]);
            if ($ext === 'jpeg') $ext = 'jpg';
            $data = base64_decode(substr($dataUrl, strpos($dataUrl, ',') + 1));
            if ($data && strlen($data) <= 12 * 1024 * 1024) {
                $dir = 'uploads/images/' . date('Y/m');
                $filename = $prefix . '_' . time() . '_' . Str::random(8) . '.' . $ext;
                $path = $dir . '/' . $filename;
                Storage::disk('public')->put($path, $data);
                return '/storage/' . $path;
            }
        }
        return $dataUrl;
    }

    /** saveFeaturedActivity */
    public function saveFeaturedActivity(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor || !in_array($actor['role'], ['admin', 'teacher'])) {
            return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์']);
        }

        $instId = trim($request->input('institutionId') ?? $request->input('institution_id') ?? $actor['institution_id'] ?? 'INS_PHRAO');
        if ($instId === 'ALL') $instId = 'INS_PHRAO';

        $featuredId = trim($request->input('featuredId') ?? '');
        if (empty($featuredId)) {
            $featuredId = (string) \Illuminate\Support\Str::uuid();
        }

        $imageUrl = $this->saveBase64ImageFile($request->input('imageUrl') ?? $request->input('image') ?? '', 'act_feat');

        \App\Models\HomeFeatured::updateOrCreate(
            ['featured_id' => $featuredId],
            [
                'institution_id' => $instId,
                'title'         => trim($request->input('title') ?? ''),
                'image_url'     => $imageUrl,
                'location_name' => trim($request->input('locationName') ?? $request->input('location') ?? ''),
                'map_link'      => trim($request->input('mapLink') ?? ''),
                'start_date'    => trim($request->input('startDate') ?? ''),
                'end_date'      => trim($request->input('endDate') ?? ''),
                'short_desc'    => trim($request->input('shortDesc') ?? $request->input('description') ?? ''),
                'is_active'     => $request->input('isActive') !== false,
            ]
        );

        return response()->json(['status' => 'success', 'featuredId' => $featuredId, 'imageUrl' => $imageUrl]);
    }

    /** saveQuarterActivity */
    public function saveQuarterActivity(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor || !in_array($actor['role'], ['admin', 'teacher'])) {
            return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์']);
        }

        $instId = trim($request->input('institutionId') ?? $request->input('institution_id') ?? $actor['institution_id'] ?? 'INS_PHRAO');
        if ($instId === 'ALL') $instId = 'INS_PHRAO';

        $id = trim($request->input('activityId') ?? '');
        if (empty($id)) {
            $id = (string) \Illuminate\Support\Str::uuid();
        }

        $imageUrl = $this->saveBase64ImageFile($request->input('imageUrl') ?? $request->input('coverImage') ?? '', 'act_q');

        $descData = [
            'description'  => trim($request->input('description') ?? ''),
            'activityDate' => trim($request->input('activityDate') ?? ''),
            'mapLink'      => trim($request->input('mapLink') ?? ''),
            'benefit'      => trim($request->input('benefit') ?? ''),
            'capacity'     => trim($request->input('capacity') ?? ''),
            'contactName'  => trim($request->input('contactName') ?? ''),
            'contactPhone' => trim($request->input('contactPhone') ?? ''),
        ];

        QuarterActivity::updateOrCreate(['id' => $id], [
            'institution_id'     => $instId,
            'activity_name'      => trim($request->input('activityName') ?? ''),
            'description'        => json_encode($descData, JSON_UNESCAPED_UNICODE),
            'image_url'          => $imageUrl,
            'location_name'      => $request->input('locationName') ?? '',
            'tambon'             => $request->input('areaCode') ?? $request->input('tambon') ?? '',
            'quarter'            => (int) ($request->input('quarter') ?? 1),
            'year'               => (int) ($request->input('year') ?? now()->year),
            'status'             => trim($request->input('status') ?? 'Active'),
            'display_order'      => (int) ($request->input('displayOrder') ?? 0),
            'learning_materials' => is_array($request->input('learningMaterials')) ? $request->input('learningMaterials') : (json_decode($request->input('learningMaterials') ?? '[]', true) ?: []),
            'external_links'     => is_array($request->input('externalLinks')) ? $request->input('externalLinks') : (json_decode($request->input('externalLinks') ?? '[]', true) ?: []),
            'video_url'          => trim($request->input('videoUrl') ?? $request->input('video_url') ?? ''),
            'is_online_enabled'  => filter_var($request->input('isOnlineEnabled') ?? true, FILTER_VALIDATE_BOOLEAN),
            'online_description' => trim($request->input('onlineDescription') ?? ''),
        ]);

        return response()->json(['status' => 'success', 'activityId' => $id, 'imageUrl' => $imageUrl]);
    }

    /** syncExternalQuarterActivity — API Webhook รับข้อมูลกิจกรรมจากระบบภายนอก */
    public function syncExternalQuarterActivity(Request $request): JsonResponse
    {
        $apiKey = $request->header('X-API-KEY') ?? $request->input('api_key') ?? $request->input('apiKey') ?? '';
        $validKey = config('app.external_api_key', 'LOFT_SYNC_KEY_2026');

        $actor = AuthService::buildActorFromRequest($request);
        $isAdmin = $actor && in_array($actor['role'], ['admin', 'teacher']);

        if (!$isAdmin && $apiKey !== $validKey) {
            return response()->json(['status' => 'error', 'message' => 'Unauthorized: API Key ไม่ถูกต้อง'], 401);
        }

        $externalId = trim($request->input('external_id') ?? $request->input('id') ?? $request->input('activityId') ?? '');
        if (empty($externalId)) {
            $externalId = (string) \Illuminate\Support\Str::uuid();
        }

        $descData = [
            'description'  => trim($request->input('description') ?? ''),
            'activityDate' => trim($request->input('activity_date') ?? $request->input('activityDate') ?? ''),
            'mapLink'      => trim($request->input('map_link') ?? $request->input('mapLink') ?? ''),
            'benefit'      => trim($request->input('benefit') ?? ''),
            'capacity'     => trim($request->input('capacity') ?? ''),
            'contactName'  => trim($request->input('contact_name') ?? $request->input('contactName') ?? $request->input('responsible_person') ?? ''),
            'contactPhone' => trim($request->input('contact_phone') ?? $request->input('contactPhone') ?? ''),
        ];

        $month = now()->month;
        $calculatedQuarter = (int) ceil($month / 3);
        $quarter = (int) ($request->input('quarter') ?? $calculatedQuarter);
        $year = (int) ($request->input('year') ?? now()->year);
        if ($year > 2500) $year -= 543;

        $activity = QuarterActivity::updateOrCreate(['id' => $externalId], [
            'activity_name'      => trim($request->input('activity_name') ?? $request->input('activityName') ?? ''),
            'description'        => json_encode($descData, JSON_UNESCAPED_UNICODE),
            'image_url'          => $request->input('image_url') ?? $request->input('imageUrl') ?? '',
            'location_name'      => $request->input('location_name') ?? $request->input('locationName') ?? '',
            'tambon'             => $request->input('tambon') ?? $request->input('areaCode') ?? '',
            'quarter'            => $quarter,
            'year'               => $year,
            'status'             => trim($request->input('status') ?? 'Active'),
            'display_order'      => (int) ($request->input('display_order') ?? $request->input('displayOrder') ?? 1),
            'learning_materials' => is_array($request->input('learning_materials')) ? $request->input('learning_materials') : (json_decode($request->input('learning_materials') ?? '[]', true) ?: []),
            'external_links'     => is_array($request->input('external_links')) ? $request->input('external_links') : (json_decode($request->input('external_links') ?? '[]', true) ?: []),
            'video_url'          => trim($request->input('video_url') ?? ''),
            'is_online_enabled'  => filter_var($request->input('is_online_enabled') ?? true, FILTER_VALIDATE_BOOLEAN),
            'online_description' => trim($request->input('online_description') ?? ''),
        ]);

        return response()->json([
            'status'     => 'success',
            'message'    => 'เชื่อมโยงและซิงค์ข้อมูลกิจกรรมประจำไตรมาสสำเร็จ',
            'activityId' => $activity->id,
        ]);
    }

    /** deleteQuarterActivity */
    public function deleteQuarterActivity(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor || !in_array($actor['role'], ['admin', 'teacher'])) {
            return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์']);
        }
        QuarterActivity::destroy($request->input('activityId'));
        return response()->json(['status' => 'success']);
    }

    /** getActivities / getStudentActivitiesAdmin — รายการกิจกรรมสถานศึกษาสำหรับเช็กอินรับแต้ม */
    public function getActivities(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        $instId = trim($request->input('institutionId') ?? $request->input('institution_id') ?? ($actor['institution_id'] ?? 'INS_PHRAO'));

        $query = Activity::query();
        if ($instId && $instId !== 'ALL' && $instId !== 'ทั้งหมด') {
            $query->where('institution_id', $instId);
        }
        if ($actor && $actor['role'] === 'teacher' && !empty($actor['tambon'])) {
            $query->where('tambon', AuthService::normalizeTambon($actor['tambon']));
        }
        if ($request->filled('tambon') && $request->input('tambon') !== 'ทั้งหมด') {
            $query->where('tambon', AuthService::normalizeTambon($request->input('tambon')));
        }
        if ($request->filled('search')) {
            $search = trim($request->input('search'));
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%")
                  ->orWhere('location', 'like', "%{$search}%");
            });
        }

        $activities = $query->orderByDesc('created_at')->get()->map(fn (Activity $activity) => $this->activityToFrontend($activity));
        return response()->json([
            'status'     => 'success',
            'activities' => $activities,
            'data'       => $activities,
            'total'      => $activities->count(),
        ]);
    }

    /** getStudentActivitiesAdmin — Alias for getActivities */
    public function getStudentActivitiesAdmin(Request $request): JsonResponse
    {
        return $this->getActivities($request);
    }

    /** createActivity / saveStudentActivity — สร้างกิจกรรมสถานศึกษาสำหรับเช็กอินรับแต้ม */
    public function createActivity(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor || !in_array($actor['role'], ['admin', 'teacher'])) {
            return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์'], 403);
        }

        $instId = trim($request->input('institutionId') ?? $request->input('institution_id') ?? ($actor['institution_id'] ?? 'INS_PHRAO'));
        if ($instId === 'ALL') $instId = 'INS_PHRAO';

        $id = trim($request->input('activityId') ?? $request->input('id') ?? ('ACT-' . strtoupper(Str::random(8))));
        $points = (int) ($request->input('checkInPoints') ?? $request->input('points') ?? 20);
        $passScore = (int) ($request->input('quizPassScore') ?? 80);

        $coverImage = trim($request->input('coverImage') ?? $request->input('imageUrl') ?? '');
        if (preg_match('/^data:image\/(\w+);base64,/', $coverImage, $matches)) {
            $ext  = $matches[1];
            $data = base64_decode(substr($coverImage, strpos($coverImage, ',') + 1));
            if ($data && strlen($data) <= 10 * 1024 * 1024) {
                $filename = 'act_' . \Illuminate\Support\Str::uuid() . '.' . $ext;
                $path = 'uploads/images/' . date('Y/m') . '/' . $filename;
                \Illuminate\Support\Facades\Storage::disk('public')->put($path, $data);
                $coverImage = '/storage/' . $path;
            }
        }

        $learningMaterials = $request->input('learningMaterials') ?? $request->input('learning_materials') ?? [];
        if (is_string($learningMaterials)) {
            $learningMaterials = json_decode($learningMaterials, true) ?: [];
        }

        $externalLinks = $request->input('externalLinks') ?? $request->input('external_links') ?? [];
        if (is_string($externalLinks)) {
            $externalLinks = json_decode($externalLinks, true) ?: [];
        }

        $videoUrl = trim((string) ($request->input('videoUrl') ?? $request->input('video_url') ?? ''));
        $isOnlineEnabled = filter_var($request->input('isOnlineEnabled') ?? $request->input('is_online_enabled') ?? true, FILTER_VALIDATE_BOOLEAN);
        $onlineDescription = trim((string) ($request->input('onlineDescription') ?? $request->input('online_description') ?? ''));

        $activity = Activity::updateOrCreate(['id' => $id], [
            'institution_id'     => $instId,
            'name'               => trim($request->input('name') ?? $request->input('activityName') ?? ''),
            'description'        => trim($request->input('description') ?? $request->input('details') ?? ''),
            'cover_image'        => $coverImage,
            'location'           => trim($request->input('location') ?? $request->input('locationName') ?? ''),
            'event_date'         => trim($request->input('eventDate') ?? $request->input('activityDate') ?? ''),
            'contact_name'       => trim($request->input('contactName') ?? ''),
            'contact_phone'      => trim($request->input('contactPhone') ?? ''),
            'tambon'             => AuthService::normalizeTambon($request->input('tambon') ?? $request->input('areaCode') ?? ($actor['tambon'] ?? '')),
            'status'             => trim($request->input('status') ?? 'Active'),
            'check_in_points'    => $points,
            'quiz_pass_score'    => $passScore,
            'learning_materials' => $learningMaterials,
            'external_links'     => $externalLinks,
            'video_url'          => $videoUrl,
            'is_online_enabled'  => $isOnlineEnabled,
            'online_description' => $onlineDescription,
        ]);

        return response()->json([
            'status'     => 'success',
            'message'    => 'บันทึกกิจกรรมสำเร็จ',
            'activityId' => $activity->id,
            'activity'   => $this->activityToFrontend($activity),
        ]);
    }

    /** updateActivity — แก้ไขกิจกรรมสถานศึกษา */
    public function updateActivity(Request $request): JsonResponse
    {
        return $this->createActivity($request);
    }

    /** deleteActivity — ลบกิจกรรมสถานศึกษา */
    public function deleteActivity(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor || !in_array($actor['role'], ['admin', 'teacher'])) {
            return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์'], 403);
        }
        $id = trim($request->input('activityId') ?? $request->input('id') ?? '');
        if (!$id) return response()->json(['status' => 'error', 'message' => 'ไม่พบรหัสกิจกรรม']);

        Activity::destroy($id);
        ActivityCheckIn::where('activity_id', $id)->delete();
        return response()->json(['status' => 'success', 'message' => 'ลบกิจกรรมสำเร็จ']);
    }

    /** checkInSource */
    public function checkInSource(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        $username = $actor['username'] ?? '';
        $rawSourceId = trim((string) ($request->input('sourceId') ?? $request->input('id') ?? $request->input('code') ?? ''));
        if (!$username) return response()->json(['status' => 'error', 'message' => 'กรุณาเข้าสู่ระบบก่อนทำการเช็กอิน'], 401);
        if (!$rawSourceId) return response()->json(['status' => 'error', 'message' => 'กรุณาระบุรหัสแหล่งเรียนรู้']);

        // Clean prefixes if any
        $cleanId = $rawSourceId;
        if (str_starts_with(strtolower($cleanId), 'source:')) $cleanId = substr($cleanId, 7);
        if (str_starts_with(strtolower($cleanId), 'src:'))    $cleanId = substr($cleanId, 4);
        if (str_starts_with(strtolower($cleanId), 'base:'))   $cleanId = substr($cleanId, 5);
        $cleanId = trim($cleanId);

        // 1. Verify existence in Source table
        $source = Source::where('id', $cleanId)->orWhereRaw('LOWER(id) = ?', [strtolower($cleanId)])->first();
        if (!$source) {
            // Check if it's a Base and resolve to parent Source
            $base = Base::where('id', $cleanId)->orWhereRaw('LOWER(id) = ?', [strtolower($cleanId)])->first();
            if ($base && $base->source_id) {
                $source = Source::find($base->source_id);
            }
        }

        if (!$source) {
            return response()->json([
                'status'  => 'error',
                'message' => 'ไม่พบแหล่งเรียนรู้ตามรหัส "' . e($rawSourceId) . '" กรุณาตรวจสอบรหัสหรือสแกนใหม่อีกครั้ง'
            ], 404);
        }

        $canonicalSourceId = $source->id;

        // Total points allocation: default 100 points
        $totalPoints = 100;
        if (!empty($source->info['points']) && is_numeric($source->info['points'])) {
            $totalPoints = (int) $source->info['points'];
        }

        // Fetch quizzes for this source if available
        $sourceQuizzes = Quiz::where('source_id', $canonicalSourceId)
            ->orderBy('display_order')
            ->get();

        $formattedQuizzes = $sourceQuizzes->map(function($q) {
            $choices = $q->choices ?? [];
            if (is_string($choices)) $choices = json_decode($choices, true) ?? [];
            if (empty($choices)) {
                $choices = array_values(array_filter([
                    $q->choice_a ?? null,
                    $q->choice_b ?? null,
                    $q->choice_c ?? null,
                    $q->choice_d ?? null,
                ]));
            }
            return [
                'quizId'   => (string) $q->id,
                'id'       => (string) $q->id,
                'question' => $q->question,
                'choices'  => array_values($choices),
            ];
        })->values()->toArray();

        $hasQuiz = count($formattedQuizzes) > 0;

        // 50% for check-in and 50% for quiz
        $checkInPoints = $hasQuiz ? (int) round($totalPoints / 2) : $totalPoints;
        $maxQuizPoints = $hasQuiz ? ($totalPoints - $checkInPoints) : 0;

        // Check if user already checked in for this source
        $existing = SourceCheckIn::where('username', $username)
            ->where(function($q) use ($canonicalSourceId) {
                $q->where('source_id', $canonicalSourceId)
                  ->orWhereRaw('LOWER(source_id) = ?', [strtolower($canonicalSourceId)]);
            })
            ->first();

        // Check if user already completed the quiz
        $quizLog = QuizLog::where('username', $username)
            ->where('source_id', $canonicalSourceId)
            ->orderByDesc('created_at')
            ->first();

        $quizCompleted = $quizLog && $quizLog->status === 'Pass';
        $quizScore = $quizLog ? (float) $quizLog->score : null;
        $earnedQuizPoints = ($quizScore !== null && $hasQuiz) ? (int) round(($quizScore / 100) * $maxQuizPoints) : 0;

        $user = User::where('username', $username)->first();
        $currentScore = $user ? (int) $user->score : 0;

        if ($existing) {
            return response()->json([
                'status'           => 'success',
                'alreadyScanned'   => true,
                'sourceId'         => $canonicalSourceId,
                'sourceName'       => $source->name,
                'description'      => $source->description ?? '',
                'location'         => $source->location ?? $source->address ?? '',
                'tambon'           => $source->tambon ?? '',
                'totalPoints'      => $totalPoints,
                'checkInPoints'    => $checkInPoints,
                'maxQuizPoints'    => $maxQuizPoints,
                'pointsEarned'     => 0,
                'scanPoints'       => 0,
                'newScore'         => $currentScore,
                'hasQuiz'          => $hasQuiz,
                'quizzes'          => $formattedQuizzes,
                'quizPassScore'    => 80,
                'quizCompleted'    => $quizCompleted,
                'quizScore'        => $quizScore,
                'earnedQuizPoints' => $earnedQuizPoints,
                'checkInTime'      => now()->toIso8601String(),
                'firstCheckInTime' => $existing->created_at ? $existing->created_at->toIso8601String() : null,
                'message'          => 'คุณได้ลงทะเบียน/เช็กอินรับคะแนนส่วนแรกไปแล้ว (' . $checkInPoints . ' แต้ม)'
            ]);
        }

        // New Check-In: award 50% check-in points
        DB::transaction(function () use ($username, $canonicalSourceId, $source, $checkInPoints, &$user, &$currentScore) {
            SourceCheckIn::create([
                'username'  => $username,
                'source_id' => $canonicalSourceId,
                'points'    => $checkInPoints
            ]);

            if ($user) {
                $currentScore = (int) $user->score + $checkInPoints;
                $user->update(['score' => $currentScore, 'level' => AuthService::levelFromScore($currentScore)]);
                PointsTransaction::create([
                    'username'    => $username,
                    'type'        => 'check_in_source',
                    'description' => "เช็คอินแหล่งเรียนรู้: {$source->name} (รับแต้มเช็กอินส่วนแรก)",
                    'points'      => $checkInPoints,
                    'ref_id'      => $canonicalSourceId,
                ]);
            }
        });

        CacheService::invalidateLeaderboard();

        return response()->json([
            'status'           => 'success',
            'alreadyScanned'   => false,
            'sourceId'         => $canonicalSourceId,
            'sourceName'       => $source->name,
            'description'      => $source->description ?? '',
            'location'         => $source->location ?? $source->address ?? '',
            'tambon'           => $source->tambon ?? '',
            'totalPoints'      => $totalPoints,
            'checkInPoints'    => $checkInPoints,
            'maxQuizPoints'    => $maxQuizPoints,
            'pointsEarned'     => $checkInPoints,
            'scanPoints'       => $checkInPoints,
            'newScore'         => $currentScore,
            'hasQuiz'          => $hasQuiz,
            'quizzes'          => $formattedQuizzes,
            'quizPassScore'    => 80,
            'quizCompleted'    => false,
            'quizScore'        => null,
            'earnedQuizPoints' => 0,
            'checkInTime'      => now()->toIso8601String(),
            'message'          => "เช็กอินสำเร็จ! คุณได้รับแต้มเช็กอิน +{$checkInPoints} แต้ม (พร้อมทำแบบทดสอบรับเพิ่มสูงสุด +{$maxQuizPoints} แต้ม)"
        ]);
    }

    /** findOrCreateActivityRecord — ค้นหาหรือซิงค์ข้อมูลกิจกรรมระหว่าง Activity และ QuarterActivity */
    private function findOrCreateActivityRecord(string $activityId): ?Activity
    {
        $activityId = trim($activityId);
        if (!$activityId) return null;

        $act = Activity::where('id', $activityId)->orWhereRaw('LOWER(id) = ?', [strtolower($activityId)])->first();
        if ($act) return $act;

        $qa = QuarterActivity::where('id', $activityId)->orWhereRaw('LOWER(id) = ?', [strtolower($activityId)])->first();
        if ($qa) {
            $descData = [];
            if (!empty($qa->description)) {
                $decoded = json_decode($qa->description, true);
                if (is_array($decoded)) $descData = $decoded;
            }

            return Activity::create([
                'id'              => $qa->id,
                'institution_id'  => $qa->institution_id ?? 'INS_PHRAO',
                'name'            => $qa->activity_name,
                'description'     => $descData['description'] ?? $qa->description ?? '',
                'cover_image'     => $qa->image_url ?? '',
                'location'        => $qa->location_name ?? '',
                'tambon'          => $qa->tambon ?? '',
                'status'          => $qa->status ?? 'Active',
                'check_in_points' => (int) ($descData['checkInPoints'] ?? 20),
                'quiz_pass_score' => (int) ($descData['quizPassScore'] ?? 80),
                'quiz_ids'        => [],
            ]);
        }
        return null;
    }

    /** checkInActivity */
    public function checkInActivity(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        $username = $actor['username'] ?? '';
        $rawActivityId = trim((string) ($request->input('activityId') ?? $request->input('id') ?? $request->input('code') ?? ''));
        if (!$username) return response()->json(['status' => 'error', 'message' => 'กรุณาเข้าสู่ระบบก่อนทำการเช็กอิน'], 401);
        if (!$rawActivityId) return response()->json(['status' => 'error', 'message' => 'กรุณาระบุรหัสกิจกรรม']);

        $cleanId = $rawActivityId;
        if (str_starts_with(strtolower($cleanId), 'activity:')) $cleanId = substr($cleanId, 9);
        if (str_starts_with(strtolower($cleanId), 'act:'))      $cleanId = substr($cleanId, 4);
        $cleanId = trim($cleanId);

        $activity = $this->findOrCreateActivityRecord($cleanId);
        if (!$activity) {
            return response()->json([
                'status'  => 'error',
                'message' => 'ไม่พบกิจกรรมตามรหัส "' . e($rawActivityId) . '" กรุณาตรวจสอบรหัสหรือสแกนใหม่อีกครั้ง'
            ], 404);
        }

        $canonicalActId = $activity->id;
        $alreadyScanned = false;
        
        $quizzes = collect($activity->quiz_ids ?? [])->values();
        $hasQuiz = $quizzes->isNotEmpty();
        $totalConfiguredPoints = (int) ($activity->check_in_points ?? 20);

        if ($hasQuiz) {
            $checkInPoints = (int) floor($totalConfiguredPoints / 2);
            $maxQuizPoints = (int) ($totalConfiguredPoints - $checkInPoints);
        } else {
            $checkInPoints = $totalConfiguredPoints;
            $maxQuizPoints = 0;
        }

        $points = $checkInPoints;
        $newScore = 0;
        $existingRecord = null;

        DB::transaction(function () use ($username, $activity, $canonicalActId, $points, &$alreadyScanned, &$newScore, &$existingRecord) {
            $user = User::where('username', $username)->lockForUpdate()->firstOrFail();
            $existingRecord = ActivityCheckIn::where('username', $username)
                ->where(function($q) use ($canonicalActId) {
                    $q->where('activity_id', $canonicalActId)
                      ->orWhereRaw('LOWER(activity_id) = ?', [strtolower($canonicalActId)]);
                })
                ->lockForUpdate()
                ->first();
            $alreadyScanned = (bool) $existingRecord;

            if (!$existingRecord) {
                ActivityCheckIn::create([
                    'username'      => $username,
                    'activity_id'   => $canonicalActId,
                    'activity_name' => $activity->name,
                    'points'        => $points,
                ]);
                if ($points > 0) {
                    $newScore = (int) $user->score + $points;
                    $user->update(['score' => $newScore, 'level' => AuthService::levelFromScore($newScore)]);
                    PointsTransaction::create([
                        'username'    => $username,
                        'type'        => 'check_in_activity',
                        'description' => 'เช็คอินกิจกรรม (แต้มส่วนแรก): '.$activity->name,
                        'points'      => $points,
                        'ref_id'      => $canonicalActId,
                    ]);
                }
            } else {
                $newScore = (int) $user->score;
            }
        });

        if (!$alreadyScanned && $points > 0) CacheService::invalidateLeaderboard();

        $learningMaterials = is_array($activity->learning_materials) ? $activity->learning_materials : (json_decode($activity->learning_materials ?? '[]', true) ?: []);
        $externalLinks = is_array($activity->external_links) ? $activity->external_links : (json_decode($activity->external_links ?? '[]', true) ?: []);

        return response()->json([
            'status'            => 'success',
            'activityId'        => $canonicalActId,
            'activityName'      => $activity->name,
            'description'       => $activity->description ?? '',
            'location'          => $activity->location ?? '',
            'tambon'            => $activity->tambon ?? '',
            'coverImage'        => $activity->cover_image ?? '',
            'checkInTime'       => now()->toIso8601String(),
            'firstCheckInTime'  => $existingRecord && $existingRecord->created_at ? $existingRecord->created_at->toIso8601String() : null,
            'alreadyScanned'    => $alreadyScanned,
            'checkInPoints'     => $checkInPoints,
            'maxQuizPoints'     => $maxQuizPoints,
            'totalPoints'       => $totalConfiguredPoints,
            'scanPoints'        => $alreadyScanned ? 0 : $checkInPoints,
            'pointsEarned'      => $alreadyScanned ? 0 : $checkInPoints,
            'newScore'          => $newScore,
            'hasQuiz'           => $hasQuiz,
            'quizzes'           => $quizzes,
            'quizPassScore'     => (int) ($activity->quiz_pass_score ?? 80),
            'quizPoints'        => $maxQuizPoints,
            'learningMaterials' => $learningMaterials,
            'externalLinks'     => $externalLinks,
            'videoUrl'          => $activity->video_url ?? '',
            'isOnlineEnabled'   => (bool) ($activity->is_online_enabled ?? true),
            'onlineDescription' => $activity->online_description ?? '',
            'message'           => $alreadyScanned 
                ? 'คุณได้ลงทะเบียน/เช็กอินรับคะแนนกิจกรรมนี้ไปแล้ว (ไม่ได้รับแต้มซ้ำ)' 
                : "เช็กอินกิจกรรมสำเร็จ! คุณได้รับแต้มสะสม +{$checkInPoints} แต้ม"
        ]);
    }

    /** getActivityCheckIns */
    public function getActivityCheckIns(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor || !in_array($actor['role'], ['admin', 'teacher'], true)) {
            return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์'], 403);
        }
        $activityId = trim($request->input('activityId') ?? $request->query('activityId') ?? '');
        if (!$activityId) return response()->json(['status' => 'error', 'message' => 'ข้อมูลไม่ครบ']);

        $checkins = ActivityCheckIn::where('activity_id', $activityId)
            ->orderByDesc('created_at')
            ->get()
            ->map(function ($ci) use ($activityId) {
                $user = User::where('username', $ci->username)->first();
                
                // Check quiz log for this user & activity
                $quizLog = QuizLog::where('username', $ci->username)
                    ->where('activity_id', $activityId)
                    ->orderByDesc('created_at')
                    ->first();

                // Check certificate for this user & activity
                $cert = Certificate::where('username', $ci->username)
                    ->where('activity_id', $activityId)
                    ->first();

                $fullName = $user->full_name ?? $user->fullname ?? '';
                if (empty($fullName)) {
                    $fullName = $ci->username;
                }

                $instName = 'สกร.ระดับอำเภอพร้าว';
                if ($user && $user->institution_id === 'INS_MAERIM') {
                    $instName = 'สกร.ระดับอำเภอแม่ริม';
                }

                $tambon = $user->tambon ?? '';

                $quizScore = $quizLog ? (int) $quizLog->score : null;
                $quizTotal = $quizLog ? (int) ($quizLog->total_questions ?? 0) : null;
                $quizPercent = ($quizLog && $quizTotal > 0) ? (int) round(($quizScore / $quizTotal) * 100) : ($quizLog ? (int) ($quizLog->percentage ?? 0) : null);
                $quizPassed = $quizLog ? (bool) ($quizLog->passed || ($quizPercent !== null && $quizPercent >= 80)) : false;

                return [
                    'id' => $ci->id,
                    'username' => $ci->username,
                    'full_name' => $fullName,
                    'phone' => $user->phone ?? '',
                    'user_category' => $user->user_category ?? 'นักศึกษา กศน./สกร.',
                    'avatar' => $user->profile_image ?? '',
                    'tambon' => $tambon,
                    'institution_id' => $user->institution_id ?? 'INS_PHRAO',
                    'institution_name' => $instName,
                    'points' => (int) ($ci->points ?? 0),
                    'createdAt' => $ci->created_at ? $ci->created_at->format('d/m/Y H:i น.') : '',
                    'created_at_raw' => $ci->created_at ? $ci->created_at->toIso8601String() : '',
                    'quiz_taken' => !empty($quizLog),
                    'quiz_score' => $quizScore,
                    'quiz_total' => $quizTotal,
                    'quiz_percent' => $quizPercent,
                    'quiz_passed' => $quizPassed,
                    'quiz_points' => $quizLog ? (int) ($quizLog->points_awarded ?? 0) : 0,
                    'has_cert' => !empty($cert),
                    'cert_no' => $cert->cert_no ?? '',
                    'cert_url' => $cert->cert_url ?? '',
                ];
            });

        $totalCheckIns = $checkins->count();
        $totalPoints = $checkins->sum('points');
        $quizTakenCount = $checkins->where('quiz_taken', true)->count();
        $quizPassedCount = $checkins->where('quiz_passed', true)->count();
        $certCount = $checkins->where('has_cert', true)->count();

        return response()->json([
            'status' => 'success',
            'activityId' => $activityId,
            'totalCheckIns' => $totalCheckIns,
            'summary' => [
                'totalCheckIns' => $totalCheckIns,
                'totalPoints' => $totalPoints,
                'quizTakenCount' => $quizTakenCount,
                'quizPassedCount' => $quizPassedCount,
                'certCount' => $certCount
            ],
            'checkIns' => $checkins,
            'data' => $checkins,
        ]);
    }

    /** getActivityQuizzes */
    public function getActivityQuizzes(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor || !in_array($actor['role'], ['admin', 'teacher'], true)) {
            return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์'], 403);
        }
        $activityId = trim($request->input('activityId') ?? '');
        $activity   = $this->findOrCreateActivityRecord($activityId);
        if (!$activity) return response()->json(['status' => 'error', 'message' => 'ไม่พบกิจกรรม']);
        $quizzes = collect($activity->quiz_ids ?? [])->values();
        return response()->json([
            'status' => 'success',
            'activityId' => $activityId,
            'activityName' => $activity->name,
            'quizPassScore' => (int) ($activity->quiz_pass_score ?? 80),
            'quizzes' => $quizzes,
            'data' => $quizzes
        ]);
    }

    /** saveActivityQuizzes */
    public function saveActivityQuizzes(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor || !in_array($actor['role'], ['admin', 'teacher'])) {
            return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์']);
        }
        $activityId = trim($request->input('activityId') ?? '');
        $activity   = $this->findOrCreateActivityRecord($activityId);
        if (!$activity) return response()->json(['status' => 'error', 'message' => 'ไม่พบกิจกรรม']);

        $quizzes = collect((array) ($request->input('quizzes') ?? []))->map(function ($quiz, $index) {
            $choices = $quiz['choices'] ?? [
                $quiz['choiceA'] ?? '', $quiz['choiceB'] ?? '',
                $quiz['choiceC'] ?? '', $quiz['choiceD'] ?? '',
            ];
            return [
                'quizId' => (string) ($quiz['quizId'] ?? 'Q-ACT-'.Str::uuid()),
                'question' => trim((string) ($quiz['question'] ?? '')),
                'choices' => array_values($choices),
                'answer' => strtoupper((string) ($quiz['answer'] ?? 'A')),
                'displayOrder' => $index + 1,
            ];
        })->filter(fn ($quiz) => $quiz['question'] !== '')->values()->all();

        $passScore = (int) ($request->input('quizPassScore') ?? $activity->quiz_pass_score ?? 80);
        $activity->update([
            'quiz_ids' => $quizzes,
            'quiz_pass_score' => $passScore,
        ]);
        return response()->json(['status' => 'success']);
    }

    /** saveActivityCertificateTemplate */
    public function saveActivityCertificateTemplate(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor || !in_array($actor['role'], ['admin', 'teacher'])) {
            return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์']);
        }
        $activityId = trim($request->input('activityId') ?? '');
        $activity   = $this->findOrCreateActivityRecord($activityId);
        if (!$activity) return response()->json(['status' => 'error', 'message' => 'ไม่พบกิจกรรม']);

        $template   = $request->input('certificateTemplate');
        $activity->update(['certificate_template' => is_string($template) ? $template : json_encode($template, JSON_UNESCAPED_UNICODE)]);
        return response()->json(['status' => 'success']);
    }

    /** submitActivityQuiz */
    public function submitActivityQuiz(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor) return response()->json(['status' => 'error', 'message' => 'กรุณาเข้าสู่ระบบ'], 401);

        $activityId = trim($request->input('activityId') ?? '');
        $activity = $this->findOrCreateActivityRecord($activityId);
        if (!$activity) return response()->json(['status' => 'error', 'message' => 'ไม่พบกิจกรรม']);

        $quizzes = collect($activity->quiz_ids ?? []);
        if ($quizzes->isEmpty()) return response()->json(['status' => 'error', 'message' => 'กิจกรรมนี้ไม่มีข้อสอบ']);
        $answers = (array) $request->input('answers', []);
        $correct = $quizzes->filter(function ($quiz, $index) use ($answers) {
            $id = (string) ($quiz['quizId'] ?? $index);
            return strtoupper((string) ($answers[$id] ?? '')) === strtoupper((string) ($quiz['answer'] ?? ''));
        })->count();
        $scorePercent = round(($correct / $quizzes->count()) * 100, 2);
        $passed = $scorePercent >= (int) ($activity->quiz_pass_score ?? 80);
        $earned = 0;
        $newScore = 0;
        $refId = 'activity-quiz:'.$activity->id;
        $certNo = '';

        // Determine attendance type (On-site if checked in via QR, Online if self-paced study)
        $hasCheckIn = ActivityCheckIn::where('username', $actor['username'])
            ->where(function($q) use ($activity) {
                $q->where('activity_id', $activity->id)
                  ->orWhereRaw('LOWER(activity_id) = ?', [strtolower($activity->id)]);
            })
            ->exists();
        $attendanceType = $hasCheckIn ? 'onsite' : 'online';

        DB::transaction(function () use ($actor, $activity, $passed, $correct, $refId, $scorePercent, $attendanceType, $hasCheckIn, &$earned, &$newScore, &$certNo) {
            $user = User::where('username', $actor['username'])->lockForUpdate()->firstOrFail();
            $alreadyAwarded = PointsTransaction::where('username', $user->username)
                ->where('type', 'activity_quiz')->where('ref_id', $refId)->exists();

            // Log the quiz attempt
            \App\Models\QuizLog::create([
                'username'        => $user->username,
                'source_id'       => null,
                'base_id'         => null,
                'activity_id'     => $activity->id,
                'attendance_type' => $attendanceType,
                'score'           => $scorePercent,
                'status'          => $passed ? 'Pass' : 'Fail',
            ]);

            if ($passed) {
                // Issue Certificate for this activity
                $cert = \App\Models\Certificate::firstOrCreate([
                    'username'    => $user->username,
                    'activity_id' => $activity->id,
                ], [
                    'source_id'       => null,
                    'base_id'         => null,
                    'attendance_type' => $attendanceType,
                    'cert_no'         => 'CERT-ACT-' . strtoupper(Str::random(8)),
                    'issued_at'       => now(),
                    'status'          => 'Active',
                ]);

                // If existing cert was online and now user attends onsite, upgrade to onsite
                if ($hasCheckIn && $cert->attendance_type !== 'onsite') {
                    $cert->update(['attendance_type' => 'onsite']);
                }

                $certNo = $cert->cert_no ?? '';

                if (!$alreadyAwarded) {
                    $totalConfiguredPoints = (int) ($activity->check_in_points ?? 20);
                    $checkInPart = (int) floor($totalConfiguredPoints / 2);
                    $maxQuizPoints = (int) ($totalConfiguredPoints - $checkInPart);
                    if ($maxQuizPoints <= 0) $maxQuizPoints = $correct * 10;

                    $earned = (int) round(($scorePercent / 100) * $maxQuizPoints);
                    $newScore = (int) $user->score + $earned;
                    $user->update(['score' => $newScore, 'level' => AuthService::levelFromScore($newScore)]);
                    
                    $pointDesc = $hasCheckIn 
                        ? 'ผ่านแบบทดสอบกิจกรรม (On-site): '.$activity->name
                        : 'ผ่านแบบทดสอบการเรียนรู้ออนไลน์ (Online Self-paced): '.$activity->name;

                    PointsTransaction::create([
                        'username' => $user->username, 'type' => 'activity_quiz',
                        'description' => $pointDesc,
                        'points' => $earned, 'ref_id' => $refId,
                    ]);
                } else {
                    $newScore = (int) $user->score;
                }
            } else {
                $newScore = (int) $user->score;
            }
        });

        if ($earned > 0) CacheService::invalidateLeaderboard();
        $checkInPoints = (int) (ActivityCheckIn::where('username', $actor['username'])->where('activity_id', $activity->id)->value('points') ?? 0);
        return response()->json([
            'status'           => 'success',
            'activityName'     => $activity->name,
            'correct'          => $correct,
            'total'            => $quizzes->count(),
            'score'            => $scorePercent,
            'passed'           => $passed,
            'passScore'        => (int) ($activity->quiz_pass_score ?? 80),
            'earnedQuizPoints' => $earned,
            'checkInPoints'    => $checkInPoints,
            'totalPointsWon'   => $checkInPoints + $earned,
            'newScore'         => $newScore,
            'certNo'           => $certNo,
            'hasCertificate'   => $passed,
            'attendanceType'   => $attendanceType,
            'isOnsite'         => $hasCheckIn,
        ]);
    }

    /** submitProposal */
    public function submitProposal(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        $username = $actor['username'] ?? '';
        if (!$username) return response()->json(['status' => 'error', 'message' => 'กรุณาเข้าสู่ระบบ'], 401);

        Proposal::create([
            'username'    => $username,
            'activity_id' => $request->input('activityId') ?? '',
            'title'       => trim($request->input('title') ?? ''),
            'description' => $request->input('description') ?? '',
            'status'      => 'Pending',
        ]);
        return response()->json(['status' => 'success']);
    }

    /** submitEvaluation */
    public function submitEvaluation(Request $request): JsonResponse
    {
        $username   = AuthService::normalizeUsername($request->input('username') ?? '');
        $proposalId = $request->input('proposalId');
        $proposal   = Proposal::find($proposalId);
        if (!$proposal) return response()->json(['status' => 'error', 'message' => 'ไม่พบข้อเสนอ']);
        $proposal->update(['evaluation_data' => $request->input('evaluation') ?? []]);
        return response()->json(['status' => 'success']);
    }

    /** submitSurvey */
    public function submitSurvey(Request $request): JsonResponse
    {
        $username   = AuthService::normalizeUsername($request->input('username') ?? '');
        $proposalId = $request->input('proposalId');
        $proposal   = Proposal::find($proposalId);
        if (!$proposal) return response()->json(['status' => 'error', 'message' => 'ไม่พบข้อเสนอ']);
        $proposal->update(['survey_data' => $request->input('survey') ?? []]);
        return response()->json(['status' => 'success']);
    }

    /** getUserProposals */
    public function getUserProposals(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        $username = $actor['username'] ?? '';
        if (!$username) return response()->json(['status' => 'error', 'message' => 'กรุณาเข้าสู่ระบบ'], 401);
        $data = Proposal::where('username', $username)->orderByDesc('created_at')->get();
        return response()->json(['status' => 'success', 'data' => $data]);
    }

    /** getPendingProposals */
    public function getPendingProposals(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor || !in_array($actor['role'], ['admin', 'teacher'])) {
            return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์']);
        }

        $query = Proposal::where('status', 'Pending')->orderByDesc('created_at');

        $instId = trim($request->input('institutionId') ?? $request->input('institution_id') ?? '');
        if (!$instId && $actor['institution_id'] !== 'ALL') {
            $instId = $actor['institution_id'];
        }
        if ($instId && $instId !== 'ALL' && $instId !== 'ทั้งหมด') {
            $query->whereHas('user', fn ($q) => $q->where('institution_id', $instId));
        }

        if ($actor['role'] === 'teacher') {
            $query->whereHas('user', fn($q) => $q->where('tambon', AuthService::normalizeTambon($actor['tambon'])));
        }
        $data = $query->with('user')->get()->map(fn (Proposal $proposal) => [
            'rowIdx' => $proposal->id,
            'proposalId' => $proposal->id,
            'title' => $proposal->title,
            'description' => $proposal->description,
            'phone' => $proposal->user?->phone ?? $proposal->username,
            'fullName' => $proposal->user?->full_name ?? '',
            'tambon' => $proposal->user?->tambon ?? '',
            'timestamp' => $proposal->created_at?->format('d/m/Y H:i'),
        ]);
        return response()->json($data);
    }

    /** reviewProposal */
    public function reviewProposal(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor || !in_array($actor['role'], ['admin', 'teacher'])) {
            return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์']);
        }
        $proposal = Proposal::with('user')->find($request->input('proposalId') ?? $request->input('rowIdx'));
        if (!$proposal) return response()->json(['status' => 'error', 'message' => 'ไม่พบข้อเสนอ']);

        if ($actor['institution_id'] !== 'ALL' && $proposal->user?->institution_id && $proposal->user->institution_id !== $actor['institution_id']) {
            return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์ตรวจข้อเสนอแนะต่างสถานศึกษา'], 403);
        }
        if ($actor['role'] === 'teacher' && AuthService::normalizeTambon((string) $proposal->user?->tambon) !== AuthService::normalizeTambon((string) $actor['tambon'])) {
            return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์ตรวจข้อเสนอแนะต่างตำบล'], 403);
        }

        $proposal->update([
            'status'      => $request->input('status') ?? 'Approved',
            'note'        => $request->input('note') ?? '',
            'reviewed_at' => now(),
            'reviewed_by' => $actor['username'],
        ]);
        return response()->json(['status' => 'success']);
    }

    /** getAISummary — ใช้ Gemini AI */
    public function getAISummary(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor || !in_array($actor['role'], ['admin', 'teacher'])) {
            return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์']);
        }

        $keyData = \App\Models\Setting::get('gemini_key');
        $apiKey  = $keyData['key'] ?? env('GEMINI_API_KEY', '');
        if (!$apiKey) return response()->json(['status' => 'error', 'message' => 'ไม่พบ Gemini API Key']);

        $prompt = $request->input('prompt') ?? 'สรุปสถิติการเรียนรู้ของระบบ';

        try {
            $response = Http::post(env('GEMINI_API_URL') . "?key={$apiKey}", [
                'contents' => [['parts' => [['text' => $prompt]]]],
            ]);

            if ($response->successful()) {
                $text = $response->json('candidates.0.content.parts.0.text') ?? '';
                return response()->json(['status' => 'success', 'summary' => $text]);
            }
            return response()->json(['status' => 'error', 'message' => 'Gemini API error: ' . $response->status()]);
        } catch (\Exception $e) {
            return response()->json(['status' => 'error', 'message' => $e->getMessage()]);
        }
    }

    /** getAdminDashboardStats */
    public function getAdminDashboardStats(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor || !in_array($actor['role'], ['admin', 'teacher'])) {
            return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์']);
        }

        $allUsersQuery = User::query();
        $query = User::where('role', 'user');

        $instId = trim($request->input('institutionId') ?? $request->input('institution_id') ?? '');
        if (!$instId && $actor['institution_id'] !== 'ALL') {
            $instId = $actor['institution_id'];
        }
        if ($instId && $instId !== 'ALL' && $instId !== 'ทั้งหมด') {
            $allUsersQuery->where('institution_id', $instId);
            $query->where('institution_id', $instId);
        }

        if ($actor['role'] === 'teacher') {
            $rawTambon = $actor['tambon'];
            $cleanTambon = AuthService::normalizeTambon($rawTambon);
            
            $query->where(function($q) use ($rawTambon, $cleanTambon) {
                if ($rawTambon) {
                    $q->where('tambon', $rawTambon);
                }
                if ($cleanTambon !== '' && $cleanTambon !== 'all') {
                    $q->orWhere('tambon', 'LIKE', '%' . $cleanTambon . '%');
                }
            });
            $allUsersQuery->where('role', 'user')->where(function($q) use ($rawTambon, $cleanTambon) {
                if ($rawTambon) {
                    $q->where('tambon', $rawTambon);
                }
                if ($cleanTambon !== '' && $cleanTambon !== 'all') {
                    $q->orWhere('tambon', 'LIKE', '%' . $cleanTambon . '%');
                }
            });
        } else {
            $inputTambon = trim((string) ($request->input('tambon') ?? ''));
            $cleanTambon = AuthService::normalizeTambon($inputTambon);
            if ($inputTambon && !in_array($inputTambon, ['all', 'ทั้งหมด'], true) && $cleanTambon !== 'all' && $cleanTambon !== '') {
                $query->where(function($q) use ($inputTambon, $cleanTambon) {
                    $q->where('tambon', $inputTambon)
                      ->orWhere('tambon', 'LIKE', '%' . $cleanTambon . '%');
                });
                $allUsersQuery->where(function($q) use ($inputTambon, $cleanTambon) {
                    $q->where('tambon', $inputTambon)
                      ->orWhere('tambon', 'LIKE', '%' . $cleanTambon . '%');
                });
            }
        }

        $users = $query->get();
        $allUsers = $allUsersQuery->get();
        $usernames = $allUsers->pluck('username');
        $ratings = Proposal::whereIn('username', $usernames)
            ->whereNotNull('evaluation_data')
            ->get()
            ->map(fn (Proposal $proposal) => (float) ($proposal->evaluation_data['rating'] ?? 0))
            ->filter(fn (float $rating) => $rating > 0);
        $learners = $users->sortByDesc('score')->values()->map(fn (User $user) => [
            'username' => $user->username,
            'phone'    => $user->phone,
            'fullName' => $user->full_name ?: $user->username,
            'name'     => $user->full_name ?: $user->username,
            'tambon'   => $user->tambon,
            'score'    => (int) $user->score,
            'level'    => (int) $user->level,
            'image'    => $user->image_status === 'Approved' ? ($user->profile_image ?? '') : '',
        ]);

        // สรุปข้อมูลการประเมินมาตรฐานแหล่งเรียนรู้ตามมาตรา 6
        $sourcesQuery = Source::query();
        if ($instId && $instId !== 'ALL' && $instId !== 'ทั้งหมด') {
            $sourcesQuery->where('institution_id', $instId);
        }

        if ($actor['role'] === 'teacher') {
            $rawTambon = $actor['tambon'];
            $cleanTambon = AuthService::normalizeTambon($rawTambon);
            $sourcesQuery->where(function($q) use ($rawTambon, $cleanTambon) {
                if ($rawTambon) {
                    $q->where('tambon', $rawTambon);
                }
                if ($cleanTambon !== '' && $cleanTambon !== 'all') {
                    $q->orWhere('tambon', 'LIKE', '%' . $cleanTambon . '%');
                }
            });
        } else {
            $inputTambon = trim((string) ($request->input('tambon') ?? ''));
            $cleanTambon = AuthService::normalizeTambon($inputTambon);
            if ($inputTambon && !in_array($inputTambon, ['all', 'ทั้งหมด'], true) && $cleanTambon !== 'all' && $cleanTambon !== '') {
                $sourcesQuery->where(function($q) use ($inputTambon, $cleanTambon) {
                    $q->where('tambon', $inputTambon)
                      ->orWhere('tambon', 'LIKE', '%' . $cleanTambon . '%');
                });
            }
        }
        $sources = $sourcesQuery->get();

        $totalSources = $sources->count();
        $evaluatedSources = $sources->filter(function($s) {
            return isset($s->info['evaluation']) && !empty($s->info['evaluation']);
        });

        $evaluatedCount = $evaluatedSources->count();
        $avgEvaluationScore = $evaluatedCount > 0 ? round($evaluatedSources->avg(function($s) {
            return (float)($s->info['evaluation']['average_score'] ?? 0);
        }), 2) : 0;

        $evaluationGrades = [
            'ดีมาก' => 0,
            'ดี' => 0,
            'พอใช้' => 0,
            'ควรปรับปรุง' => 0,
            'ต้องปรับปรุง' => 0
        ];
        foreach ($evaluatedSources as $s) {
            $g = $s->info['evaluation']['grade'] ?? '';
            if (isset($evaluationGrades[$g])) {
                $evaluationGrades[$g]++;
            }
        }

        $topAreas = $allUsers->filter(fn (User $user) => trim((string) $user->tambon) !== '')
            ->groupBy('tambon')
            ->map(fn ($items, $name) => ['name' => $name, 'count' => $items->count()])
            ->sortByDesc('count')->take(10)->values();

        // 📊 คำนวณสถิติสำหรับ Executive Dashboard (รายตำบล)
        $sourcesByTambon = $sources->filter(fn($s) => trim((string)$s->tambon) !== '')
            ->groupBy('tambon')
            ->map->count()
            ->toArray();

        $scoresByTambon = $allUsers->filter(fn($u) => trim((string)$u->tambon) !== '')
            ->groupBy('tambon')
            ->map(fn($items) => (int) $items->sum('score'))
            ->toArray();

        $certsQuery = DB::table('certificates')
            ->join('users', 'certificates.username', '=', 'users.username')
            ->select('users.tambon', DB::raw('count(certificates.id) as count'))
            ->whereNotNull('users.tambon')
            ->where('users.tambon', '!=', '');

        if ($instId && $instId !== 'ALL' && $instId !== 'ทั้งหมด') {
            $certsQuery->where('users.institution_id', $instId);
        }
        
        if ($actor['role'] === 'teacher') {
            $rawTambon = $actor['tambon'];
            $cleanTambon = AuthService::normalizeTambon($rawTambon);
            $certsQuery->where(function($q) use ($rawTambon, $cleanTambon) {
                if ($rawTambon) $q->where('users.tambon', $rawTambon);
                if ($cleanTambon !== '' && $cleanTambon !== 'all') {
                    $q->orWhere('users.tambon', 'LIKE', '%' . $cleanTambon . '%');
                }
            });
        }
        $certsByTambon = $certsQuery->groupBy('users.tambon')
            ->pluck('count', 'users.tambon')
            ->toArray();

        // รวบรวมตารางเปรียบเทียบสถิติทุกลักษณะงานรายตำบล (Area Breakdown Table)
        $tambonUserCounts = $allUsers->filter(fn($u) => trim((string)$u->tambon) !== '')
            ->groupBy('tambon')
            ->map->count()
            ->toArray();

        $allTambonNames = array_unique(array_merge(
            array_keys($tambonUserCounts),
            array_keys($sourcesByTambon),
            array_keys($certsByTambon)
        ));
        sort($allTambonNames);

        $areaComparisonTable = [];
        foreach ($allTambonNames as $tb) {
            if (!$tb) continue;
            $uCnt = $tambonUserCounts[$tb] ?? 0;
            $sCnt = $sourcesByTambon[$tb] ?? 0;
            $cCnt = $certsByTambon[$tb] ?? 0;
            $scSum = $scoresByTambon[$tb] ?? 0;

            $areaComparisonTable[] = [
                'tambon'       => $tb,
                'usersCount'   => $uCnt,
                'sourcesCount' => $sCnt,
                'certsCount'   => $cCnt,
                'totalScore'   => $scSum,
            ];
        }
        usort($areaComparisonTable, fn($a, $b) => $b['usersCount'] <=> $a['usersCount']);

        return response()->json([
            'status'              => 'success',
            'totalUsers'          => $allUsers->count(),
            'totalLearners'       => $users->count(),
            'totalScore'          => $allUsers->sum('score'),
            'avgScore'            => $users->count() > 0 ? round($users->avg('score'), 2) : 0,
            'levelCounts'         => $users->groupBy('level')->map->count()->toArray(),
            'tambonCounts'        => $tambonUserCounts,
            'sourcesByTambon'     => $sourcesByTambon,
            'scoresByTambon'      => $scoresByTambon,
            'certsByTambon'       => $certsByTambon,
            'areaComparisonTable' => $areaComparisonTable,
            'totalCerts'          => DB::table('certificates')->whereIn('username', $usernames)->count(),
            'avgSatisfaction'     => $ratings->isNotEmpty() ? round($ratings->avg(), 1) : 0,
            'totalRatings'        => $ratings->count(),
            'pendingProposals'    => Proposal::whereIn('username', $usernames)->where('status', 'Pending')->count(),
            'learners'            => $learners,
            'topAreas'            => $topAreas,
            'evaluationStats'     => [
                'totalSources'   => $totalSources,
                'evaluatedCount' => $evaluatedCount,
                'avgScore'       => $avgEvaluationScore,
                'grades'         => $evaluationGrades
            ],
        ]);
    }

    /** getDashboard — สำหรับหน้าภาพรวม / Dashboard */
    public function getDashboard(Request $request): JsonResponse
    {
        $response = $this->getAdminDashboardStats($request);
        $data = $response->getData(true);
        if (is_array($data) && isset($data['status']) && $data['status'] === 'success') {
            $data['ranking'] = $data['learners'] ?? [];
            $data['userCount'] = $data['totalLearners'] ?? 0;
            return response()->json($data);
        }
        return $response;
    }

    /** uploadImage */
    public function uploadImage(Request $request): JsonResponse
    {
        return app(FileController::class)->uploadImage($request);
    }

    /** uploadGeneralImage */
    public function uploadGeneralImage(Request $request): JsonResponse
    {
        return app(FileController::class)->uploadGeneralImage($request);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // 🌟 ACTIVITY SATISFACTION EVALUATION & EXECUTIVE REPORT METHODS
    // ═════════════════════════════════════════════════════════════════════════

    /** submitActivityEvaluation — บันทึกแบบประเมินความพึงพอใจกิจกรรม */
    public function submitActivityEvaluation(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        $username = $actor['username'] ?? $request->input('username') ?? $request->input('phone') ?? '';
        $rawActivityId = trim((string) ($request->input('activityId') ?? $request->input('activity_id') ?? $request->input('id') ?? ''));

        if (!$username) {
            return response()->json(['status' => 'error', 'message' => 'กรุณาเข้าสู่ระบบก่อนทำแบบประเมิน'], 401);
        }
        if (!$rawActivityId) {
            return response()->json(['status' => 'error', 'message' => 'กรุณาระบุรหัสกิจกรรม']);
        }

        $cleanId = $rawActivityId;
        if (str_starts_with(strtolower($cleanId), 'activity:')) $cleanId = substr($cleanId, 9);
        if (str_starts_with(strtolower($cleanId), 'act:'))      $cleanId = substr($cleanId, 4);
        $cleanId = trim($cleanId);

        $activity = $this->findOrCreateActivityRecord($cleanId);
        $activityName = $activity ? $activity->name : ($request->input('activityName') ?? $request->input('name') ?? $cleanId);
        $canonicalActId = $activity ? $activity->id : $cleanId;

        $user = User::where('username', $username)->first();
        if (!$user) {
            return response()->json(['status' => 'error', 'message' => 'ไม่พบข้อมูลผู้ใช้งาน'], 404);
        }

        // Check duplicate
        $existing = ActivityEvaluation::where('activity_id', $canonicalActId)
            ->where('username', $username)
            ->first();

        $rawRatings = $request->input('ratings');
        if (is_string($rawRatings)) {
            $rawRatings = json_decode($rawRatings, true) ?? [];
        }
        if (!is_array($rawRatings)) {
            $rawRatings = [];
        }

        // Extract and calculate average score (from ratings 1-5)
        $ratingValues = array_filter(array_map('floatval', array_values($rawRatings)), fn($v) => $v >= 1 && $v <= 5);
        $avgScore = count($ratingValues) > 0 ? round(array_sum($ratingValues) / count($ratingValues), 2) : 5.00;

        $impressions  = trim((string) ($request->input('feedbackImpressions') ?? $request->input('feedback_impressions') ?? ''));
        $suggestions  = trim((string) ($request->input('feedbackSuggestions') ?? $request->input('feedback_suggestions') ?? ''));
        $futureTopics = trim((string) ($request->input('feedbackFutureTopics') ?? $request->input('feedback_future_topics') ?? ''));

        $gender     = $request->input('gender') ?? $user->gender ?? 'ไม่ระบุ';
        $ageGroup   = $request->input('ageGroup') ?? $request->input('age_group') ?? $user->age_group ?? 'ไม่ระบุ';
        $occupation = $request->input('occupation') ?? $user->occupation ?? 'ไม่ระบุ';
        $tambon     = $request->input('tambon') ?? $user->tambon ?? $activity?->tambon ?? 'อำเภอพร้าว';

        $awardedPoints = 0;
        $isFirstTime = false;

        DB::transaction(function () use ($existing, $canonicalActId, $activityName, $username, $rawRatings, $avgScore, $impressions, $suggestions, $futureTopics, $gender, $ageGroup, $occupation, $tambon, $user, &$awardedPoints, &$isFirstTime) {
            if ($existing) {
                $existing->update([
                    'activity_name'          => $activityName,
                    'ratings'                => $rawRatings,
                    'overall_score'          => $avgScore,
                    'feedback_impressions'   => $impressions,
                    'feedback_suggestions'   => $suggestions,
                    'feedback_future_topics' => $futureTopics,
                    'gender'                 => $gender,
                    'age_group'              => $ageGroup,
                    'occupation'             => $occupation,
                    'tambon'                 => $tambon,
                ]);
            } else {
                $isFirstTime = true;
                ActivityEvaluation::create([
                    'activity_id'            => $canonicalActId,
                    'activity_name'          => $activityName,
                    'username'               => $username,
                    'ratings'                => $rawRatings,
                    'overall_score'          => $avgScore,
                    'feedback_impressions'   => $impressions,
                    'feedback_suggestions'   => $suggestions,
                    'feedback_future_topics' => $futureTopics,
                    'gender'                 => $gender,
                    'age_group'              => $ageGroup,
                    'occupation'             => $occupation,
                    'tambon'                 => $tambon,
                ]);

                // Award +10 points for completing the satisfaction survey
                $awardedPoints = 10;
                $user->score = (int) ($user->score ?? 0) + $awardedPoints;
                $user->level = AuthService::levelFromScore($user->score);
                $user->save();

                PointsTransaction::create([
                    'username'    => $username,
                    'type'        => 'survey_evaluation',
                    'points'      => $awardedPoints,
                    'description' => 'ทำแบบประเมินความพึงพอใจ: ' . $activityName,
                    'ref_id'      => $canonicalActId,
                ]);

                CacheService::forgetUserProfile($username);
                CacheService::invalidateLeaderboard($username);
            }
        });

        $user->refresh();

        return response()->json([
            'status'         => 'success',
            'message'        => $isFirstTime 
                ? "บันทึกแบบประเมินความพึงพอใจเรียบร้อยแล้ว (+{$awardedPoints} แต้ม)" 
                : 'อัปเดตแบบประเมินความพึงพอใจเรียบร้อยแล้ว',
            'isFirstTime'    => $isFirstTime,
            'awardedPoints'  => $awardedPoints,
            'overallScore'   => $avgScore,
            'newScore'       => (int) $user->score,
            'newLevel'       => (int) $user->level,
            'activityId'     => $canonicalActId,
            'activityName'   => $activityName,
        ]);
    }

    /** getActivityEvaluationStatus — ตรวจสอบสถานะการทำแบบประเมิน */
    public function getActivityEvaluationStatus(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        $username = $actor['username'] ?? $request->input('username') ?? $request->input('phone') ?? '';
        $rawActivityId = trim((string) ($request->input('activityId') ?? $request->input('activity_id') ?? $request->input('id') ?? ''));

        if (!$username || !$rawActivityId) {
            return response()->json(['status' => 'success', 'hasEvaluated' => false]);
        }

        $cleanId = $rawActivityId;
        if (str_starts_with(strtolower($cleanId), 'activity:')) $cleanId = substr($cleanId, 9);
        if (str_starts_with(strtolower($cleanId), 'act:'))      $cleanId = substr($cleanId, 4);
        $cleanId = trim($cleanId);

        $eval = ActivityEvaluation::where(function($q) use ($cleanId) {
                $q->where('activity_id', $cleanId)
                  ->orWhereRaw('LOWER(activity_id) = ?', [strtolower($cleanId)]);
            })
            ->where('username', $username)
            ->first();

        return response()->json([
            'status'       => 'success',
            'hasEvaluated' => (bool) $eval,
            'evaluation'   => $eval ? [
                'id'            => $eval->id,
                'overallScore'  => (float) $eval->overall_score,
                'ratings'       => $eval->ratings,
                'evaluatedAt'   => $eval->created_at?->format('d/m/Y H:i') ?? '—',
                'impressions'   => $eval->feedback_impressions,
                'suggestions'   => $eval->feedback_suggestions,
                'futureTopics'  => $eval->feedback_future_topics,
            ] : null,
        ]);
    }

    /** getActivityReportData — สรุปข้อมูลรายงานภาพรวมโครงการ */
    public function getActivityReportData(Request $request): JsonResponse
    {
        $rawActivityId = trim((string) ($request->input('activityId') ?? $request->input('activity_id') ?? $request->input('id') ?? ''));
        if (!$rawActivityId) {
            return response()->json(['status' => 'error', 'message' => 'กรุณาระบุรหัสกิจกรรม']);
        }

        $cleanId = $rawActivityId;
        if (str_starts_with(strtolower($cleanId), 'activity:')) $cleanId = substr($cleanId, 9);
        if (str_starts_with(strtolower($cleanId), 'act:'))      $cleanId = substr($cleanId, 4);
        $cleanId = trim($cleanId);

        $data = $this->buildActivityReportData($cleanId);
        if (!$data) {
            return response()->json(['status' => 'error', 'message' => 'ไม่พบข้อมูลกิจกรรมตามรหัสที่ระบุ'], 404);
        }

        return response()->json([
            'status' => 'success',
            'data'   => $data,
        ]);
    }

    /** exportActivityProjectDocx — สร้างและดาวน์โหลดไฟล์ Word (.docx) สรุปรายงานโครงการ */
    public function exportActivityProjectDocx(Request $request)
    {
        $rawActivityId = trim((string) ($request->input('activityId') ?? $request->input('activity_id') ?? $request->input('id') ?? ''));
        if (!$rawActivityId) {
            return response()->json(['status' => 'error', 'message' => 'กรุณาระบุรหัสกิจกรรม'], 400);
        }

        $cleanId = $rawActivityId;
        if (str_starts_with(strtolower($cleanId), 'activity:')) $cleanId = substr($cleanId, 9);
        if (str_starts_with(strtolower($cleanId), 'act:'))      $cleanId = substr($cleanId, 4);
        $cleanId = trim($cleanId);

        $report = $this->buildActivityReportData($cleanId);
        if (!$report) {
            return response()->json(['status' => 'error', 'message' => 'ไม่พบข้อมูลกิจกรรม'], 404);
        }

        $act = $report['activity'];
        $inst = $report['institution'];
        $stats = $report['participation'];
        $quizStats = $report['quiz'];
        $survey = $report['satisfaction'];

        // Initialize PhpWord
        $phpWord = new PhpWord();
        $phpWord->setDefaultFontName('TH SarabunPSK');
        $phpWord->setDefaultFontSize(15);

        // 🌟 Disable spell check red squiggly underlines & grammar errors in Microsoft Word
        $phpWord->getSettings()->setHideSpellingErrors(true);
        $phpWord->getSettings()->setHideGrammaticalErrors(true);
        $proofState = new ProofState();
        $proofState->setSpelling('clean');
        $proofState->setGrammar('clean');
        $phpWord->getSettings()->setProofState($proofState);

        $thLang = new Language();
        $thLang->setLatin('th-TH');
        $thLang->setEastAsia('th-TH');
        $thLang->setBidirectional('th-TH');
        $phpWord->getSettings()->setThemeFontLang($thLang);

        // Define Styles (with noProof & th-TH Language)
        $title1Font = ['name' => 'TH SarabunPSK', 'bold' => true, 'size' => 18, 'color' => '0F172A', 'noProof' => true, 'lang' => $thLang];
        $title2Font = ['name' => 'TH SarabunPSK', 'bold' => true, 'size' => 16, 'color' => '1E3A8A', 'noProof' => true, 'lang' => $thLang];
        $title3Font = ['name' => 'TH SarabunPSK', 'bold' => true, 'size' => 15, 'color' => '065F46', 'noProof' => true, 'lang' => $thLang];

        $phpWord->addTitleStyle(1, $title1Font, ['spaceAfter' => 100, 'alignment' => Jc::CENTER]);
        $phpWord->addTitleStyle(2, $title2Font, ['spaceBefore' => 180, 'spaceAfter' => 80]);
        $phpWord->addTitleStyle(3, $title3Font, ['spaceBefore' => 120, 'spaceAfter' => 60]);

        $tableHeaderStyle = ['bgColor' => 'E2EFDA', 'alignment' => JcTable::CENTER];
        $tableHeaderSubStyle = ['bgColor' => 'F2F2F2', 'alignment' => JcTable::CENTER];
        $cellHeaderFont = ['name' => 'TH SarabunPSK', 'bold' => true, 'size' => 14, 'color' => '1E293B', 'noProof' => true, 'lang' => $thLang];
        $cellBodyFont   = ['name' => 'TH SarabunPSK', 'size' => 14, 'color' => '334155', 'noProof' => true, 'lang' => $thLang];
        $cellBoldFont   = ['name' => 'TH SarabunPSK', 'bold' => true, 'size' => 14, 'color' => '0F172A', 'noProof' => true, 'lang' => $thLang];
        $cellBlueFont   = ['name' => 'TH SarabunPSK', 'bold' => true, 'size' => 14, 'color' => '1E3A8A', 'noProof' => true, 'lang' => $thLang];

        $tableStyle = [
            'borderSize'  => 6,
            'borderColor' => 'CBD5E1',
            'cellMargin'  => 80,
            'alignment'   => JcTable::CENTER,
        ];
        $phpWord->addTableStyle('ReportTable', $tableStyle, $tableHeaderStyle);

        // Section Page Settings (A4, 2.54cm margins)
        $section = $phpWord->addSection([
            'paperSize'    => 'A4',
            'marginTop'    => 1440,
            'marginBottom' => 1440,
            'marginLeft'   => 1440,
            'marginRight'  => 1440,
        ]);

        // Header Title
        $section->addText('แบบรายงานสรุปผลการดำเนินงานโครงการ / กิจกรรมสถานศึกษา', $title1Font, ['alignment' => Jc::CENTER, 'spaceAfter' => 40]);
        $section->addText($inst['name'] ?? 'ศูนย์ส่งเสริมการเรียนรู้ระดับอำเภอพร้าว (สกร.ระดับอำเภอพร้าว)', ['name' => 'TH SarabunPSK', 'bold' => true, 'size' => 16, 'color' => '2563EB', 'noProof' => true, 'lang' => $thLang], ['alignment' => Jc::CENTER, 'spaceAfter' => 180]);

        $formattedEventDate = !empty($act['date']) ? $this->formatThaiDateLong($act['date']) : 'ตามแผนปฏิบัติการประจำปี ๒๕๖๙';

        // Box 1: Project Overview Table
        $section->addTitle('๑. ข้อมูลทั่วไปของโครงการ/กิจกรรม', 2);
        
        $tableInfo = $section->addTable('ReportTable');
        $tableInfo->addRow();
        $tableInfo->addCell(2500, ['bgColor' => 'F8FAFC'])->addText('ชื่อโครงการ/กิจกรรม:', $cellBoldFont);
        $tableInfo->addCell(6500)->addText($act['name'], $cellBoldFont);

        $tableInfo->addRow();
        $tableInfo->addCell(2500, ['bgColor' => 'F8FAFC'])->addText('รหัสกิจกรรม:', $cellBoldFont);
        $tableInfo->addCell(6500)->addText($act['id'], $cellBodyFont);

        $tableInfo->addRow();
        $tableInfo->addCell(2500, ['bgColor' => 'F8FAFC'])->addText('วัน/เวลาที่จัดกิจกรรม:', $cellBoldFont);
        $tableInfo->addCell(6500)->addText($formattedEventDate, $cellBodyFont);

        $tableInfo->addRow();
        $tableInfo->addCell(2500, ['bgColor' => 'F8FAFC'])->addText('สถานที่จัดกิจกรรม:', $cellBoldFont);
        $tableInfo->addCell(6500)->addText(($act['location'] ?: 'ศกร.ระดับตำบล/ศศช.') . ' ' . ($act['tambon'] ? "($act[tambon])" : ''), $cellBodyFont);

        $tableInfo->addRow();
        $tableInfo->addCell(2500, ['bgColor' => 'F8FAFC'])->addText('หน่วยงานที่รับผิดชอบ:', $cellBoldFont);
        $tableInfo->addCell(6500)->addText($inst['name'] ?? 'สกร.ระดับอำเภอพร้าว', $cellBodyFont);

        $tableInfo->addRow();
        $tableInfo->addCell(2500, ['bgColor' => 'F8FAFC'])->addText('รายละเอียด/วัตถุประสงค์:', $cellBoldFont);
        $tableInfo->addCell(6500)->addText($act['description'] ?: 'เพื่อส่งเสริมการเรียนรู้ตลอดชีวิต พัฒนาทักษะ และเสริมสร้างประสบการณ์แก่ผู้เรียนและประชาชนในชุมชน', $cellBodyFont);

        // Section 2: Participation Statistics
        $section->addTitle('๒. สถิติและข้อมูลกลุ่มเป้าหมายผู้เข้าร่วมโครงการ (Hybrid Learning)', 2);
        $section->addText("โครงการนี้ได้เปิดโอกาสการเรียนรู้แบบผสมผสาน (Hybrid Model) ทั้งการเข้าร่วม ณ สถานที่จัดงานจริง (On-site) และการศึกษาเรียนรู้ด้วยตนเองผ่านระบบออนไลน์ตลอดชีวิต (Online Self-paced) โดยมียอดผู้เข้าร่วมรวมทั้งสิ้น {$stats['totalCombinedLearners']} คน ดังนี้:", $cellBodyFont, ['spaceAfter' => 80]);

        $tableChannel = $section->addTable('ReportTable');
        $tableChannel->addRow();
        $tableChannel->addCell(6000, ['bgColor' => 'E2EFDA'])->addText('ช่องทางการเข้าร่วมและการเรียนรู้', $cellHeaderFont, ['alignment' => Jc::CENTER]);
        $tableChannel->addCell(3000, ['bgColor' => 'E2EFDA'])->addText('จำนวนผู้เรียน (คน)', $cellHeaderFont, ['alignment' => Jc::CENTER]);

        $tableChannel->addRow();
        $tableChannel->addCell(6000)->addText('๑. ผู้เข้าร่วมกิจกรรม ณ สถานที่จัดงานจริง (On-site Participants)', $cellBodyFont);
        $tableChannel->addCell(3000)->addText("{$stats['onsiteCheckIns']} คน", $cellBoldFont, ['alignment' => Jc::CENTER]);

        $tableChannel->addRow();
        $tableChannel->addCell(6000)->addText('๒. ผู้ศึกษาเรียนรู้ด้วยตนเองผ่านระบบออนไลน์ (Online Self-paced Learners)', $cellBodyFont);
        $tableChannel->addCell(3000)->addText("{$stats['onlineLearners']} คน", $cellBoldFont, ['alignment' => Jc::CENTER]);

        $tableChannel->addRow();
        $tableChannel->addCell(6000, ['bgColor' => 'F8FAFC'])->addText('รวมยอดผู้ได้รับการพัฒนาองค์ความรู้ตลอดชีวิตทั้งสิ้น', $cellBlueFont);
        $tableChannel->addCell(3000, ['bgColor' => 'F8FAFC'])->addText("{$stats['totalCombinedLearners']} คน", $cellBlueFont, ['alignment' => Jc::CENTER]);

        $section->addText("รายละเอียดข้อมูลกลุ่มเป้าหมายจำแนกตามประชากรศาสตร์ (ผู้เข้าร่วม ณ สถานที่จริง):", $cellBoldFont, ['spaceBefore' => 120, 'spaceAfter' => 60]);

        $tablePart = $section->addTable('ReportTable');
        $tablePart->addRow();
        $tablePart->addCell(4500, ['bgColor' => 'E2EFDA'])->addText('กลุ่มข้อมูลประชากรศาสตร์', $cellHeaderFont, ['alignment' => Jc::CENTER]);
        $tablePart->addCell(2250, ['bgColor' => 'E2EFDA'])->addText('จำนวน (คน)', $cellHeaderFont, ['alignment' => Jc::CENTER]);
        $tablePart->addCell(2250, ['bgColor' => 'E2EFDA'])->addText('ร้อยละ (%)', $cellHeaderFont, ['alignment' => Jc::CENTER]);

        // Gender rows
        $tablePart->addRow();
        $tablePart->addCell(9000, ['gridSpan' => 3, 'bgColor' => 'F1F5F9'])->addText('จำแนกตามเพศ', $cellBoldFont);
        foreach ($stats['demographics']['gender'] as $g => $count) {
            $pct = $stats['totalCheckIns'] > 0 ? round(($count / $stats['totalCheckIns']) * 100, 1) : 0;
            $tablePart->addRow();
            $tablePart->addCell(4500)->addText("  • เพศ{$g}", $cellBodyFont);
            $tablePart->addCell(2250)->addText(number_format($count), $cellBodyFont, ['alignment' => Jc::CENTER]);
            $tablePart->addCell(2250)->addText("{$pct}%", $cellBodyFont, ['alignment' => Jc::CENTER]);
        }

        // Age group rows
        $tablePart->addRow();
        $tablePart->addCell(9000, ['gridSpan' => 3, 'bgColor' => 'F1F5F9'])->addText('จำแนกตามช่วงอายุ', $cellBoldFont);
        foreach ($stats['demographics']['ageGroup'] as $age => $count) {
            $pct = $stats['totalCheckIns'] > 0 ? round(($count / $stats['totalCheckIns']) * 100, 1) : 0;
            $tablePart->addRow();
            $tablePart->addCell(4500)->addText("  • {$age}", $cellBodyFont);
            $tablePart->addCell(2250)->addText(number_format($count), $cellBodyFont, ['alignment' => Jc::CENTER]);
            $tablePart->addCell(2250)->addText("{$pct}%", $cellBodyFont, ['alignment' => Jc::CENTER]);
        }

        // Occupation rows
        $tablePart->addRow();
        $tablePart->addCell(9000, ['gridSpan' => 3, 'bgColor' => 'F1F5F9'])->addText('จำแนกตามกลุ่มอาชีพ / สถานะ', $cellBoldFont);
        foreach ($stats['demographics']['occupation'] as $occ => $count) {
            $pct = $stats['totalCheckIns'] > 0 ? round(($count / $stats['totalCheckIns']) * 100, 1) : 0;
            $tablePart->addRow();
            $tablePart->addCell(4500)->addText("  • {$occ}", $cellBodyFont);
            $tablePart->addCell(2250)->addText(number_format($count), $cellBodyFont, ['alignment' => Jc::CENTER]);
            $tablePart->addCell(2250)->addText("{$pct}%", $cellBodyFont, ['alignment' => Jc::CENTER]);
        }

        // Section 3: Learning Assessment / Quiz Results
        $section->addTitle('๓. ผลการทดสอบวัดความรู้และการประเมินผลสัมฤทธิ์ทางการเรียนรู้', 2);
        $section->addText("จากการจัดกิจกรรม มีการทดสอบวัดความรู้ (เกณฑ์การผ่านร้อยละ {$act['quizPassScore']}) โดยมีผลการประเมินสรุปดังนี้:", $cellBodyFont, ['spaceAfter' => 80]);

        $tableQuiz = $section->addTable('ReportTable');
        $tableQuiz->addRow();
        $tableQuiz->addCell(4500, ['bgColor' => 'E2EFDA'])->addText('รายการประเมินผลการเรียนรู้', $cellHeaderFont, ['alignment' => Jc::CENTER]);
        $tableQuiz->addCell(4500, ['bgColor' => 'E2EFDA'])->addText('ผลการดำเนินงาน', $cellHeaderFont, ['alignment' => Jc::CENTER]);

        $tableQuiz->addRow();
        $tableQuiz->addCell(4500)->addText('จำนวนผู้เข้าทำแบบทดสอบทั้งหมด', $cellBodyFont);
        $tableQuiz->addCell(4500)->addText("{$quizStats['totalTakers']} คน", $cellBoldFont, ['alignment' => Jc::CENTER]);

        $tableQuiz->addRow();
        $tableQuiz->addCell(4500)->addText('จำนวนผู้ผ่านเกณฑ์การประเมิน', $cellBodyFont);
        $tableQuiz->addCell(4500)->addText("{$quizStats['passedCount']} คน (ร้อยละ {$quizStats['passRate']}%)", $cellBoldFont, ['alignment' => Jc::CENTER]);

        $tableQuiz->addRow();
        $tableQuiz->addCell(4500)->addText('  - ผู้ผ่านเกณฑ์จากการเข้าร่วม On-site', $cellBodyFont);
        $tableQuiz->addCell(4500)->addText("{$quizStats['onsiteQuizPasses']} คน", $cellBodyFont, ['alignment' => Jc::CENTER]);

        $tableQuiz->addRow();
        $tableQuiz->addCell(4500)->addText('  - ผู้ผ่านเกณฑ์จากการเรียนรู้ Online ด้วยตนเอง', $cellBodyFont);
        $tableQuiz->addCell(4500)->addText("{$quizStats['onlineQuizPasses']} คน", $cellBodyFont, ['alignment' => Jc::CENTER]);

        $tableQuiz->addRow();
        $tableQuiz->addCell(4500)->addText('คะแนนเฉลี่ยของผู้เข้าสอบ (Mean)', $cellBodyFont);
        $tableQuiz->addCell(4500)->addText("{$quizStats['avgScore']}%", $cellBodyFont, ['alignment' => Jc::CENTER]);

        $tableQuiz->addRow();
        $tableQuiz->addCell(4500)->addText('คะแนนสูงสุด - คะแนนต่ำสุด (Max - Min)', $cellBodyFont);
        $tableQuiz->addCell(4500)->addText("{$quizStats['maxScore']}% - {$quizStats['minScore']}%", $cellBodyFont, ['alignment' => Jc::CENTER]);

        $tableQuiz->addRow();
        $tableQuiz->addCell(4500)->addText('ส่วนเบี่ยงเบนมาตรฐาน (S.D.)', $cellBodyFont);
        $tableQuiz->addCell(4500)->addText("{$quizStats['sd']}", $cellBodyFont, ['alignment' => Jc::CENTER]);

        $tableQuiz->addRow();
        $tableQuiz->addCell(4500)->addText('จำนวนใบประกาศนียบัตร/เกียรติบัตรที่ได้รับอนุมัติ', $cellBoldFont);
        $tableQuiz->addCell(4500)->addText("รวม {$quizStats['certsIssued']} ฉบับ (On-site {$quizStats['onsiteCerts']} ฉบับ / Online {$quizStats['onlineCerts']} ฉบับ)", $cellBoldFont, ['alignment' => Jc::CENTER]);

        // Section 4: Satisfaction Survey Results
        $section->addTitle('๔. ผลการประเมินความพึงพอใจของผู้เข้าร่วมโครงการ', 2);
        $section->addText("มีผู้ตอบแบบประเมินความพึงพอใจทั้งสิ้นจำนวน {$survey['totalRespondents']} คน คะแนนความพึงพอใจในภาพรวมเฉลี่ยเท่ากับ {$survey['overallMean']} (S.D. = {$survey['overallSD']}) คิดเป็นร้อยละ {$survey['overallPercent']}% อยู่ในระดับคุณภาพ \"{$survey['overallQuality']}\" โดยมีผลการประเมินรายด้านและรายข้อ ดังตารางต่อไปนี้:", $cellBodyFont, ['spaceAfter' => 80]);

        $tableSat = $section->addTable('ReportTable');
        $tableSat->addRow();
        $tableSat->addCell(4800, ['bgColor' => 'E2EFDA'])->addText('ประเด็นการประเมินความพึงพอใจ', $cellHeaderFont, ['alignment' => Jc::CENTER]);
        $tableSat->addCell(1200, ['bgColor' => 'E2EFDA'])->addText('ค่าเฉลี่ย (X̄)', $cellHeaderFont, ['alignment' => Jc::CENTER]);
        $tableSat->addCell(1200, ['bgColor' => 'E2EFDA'])->addText('S.D.', $cellHeaderFont, ['alignment' => Jc::CENTER]);
        $tableSat->addCell(1800, ['bgColor' => 'E2EFDA'])->addText('ระดับคุณภาพ', $cellHeaderFont, ['alignment' => Jc::CENTER]);

        foreach ($survey['dimensions'] as $dim) {
            // Dimension Header
            $tableSat->addRow();
            $tableSat->addCell(9000, ['gridSpan' => 4, 'bgColor' => 'F1F5F9'])->addText($dim['name'], $cellBoldFont);

            foreach ($dim['items'] as $item) {
                $tableSat->addRow();
                $tableSat->addCell(4800)->addText("  {$item['num']}. {$item['title']}", $cellBodyFont);
                $tableSat->addCell(1200)->addText(number_format($item['mean'], 2), $cellBodyFont, ['alignment' => Jc::CENTER]);
                $tableSat->addCell(1200)->addText(number_format($item['sd'], 2), $cellBodyFont, ['alignment' => Jc::CENTER]);
                $tableSat->addCell(1800)->addText($item['quality'], $cellBodyFont, ['alignment' => Jc::CENTER]);
            }

            // Dimension Summary Row
            $tableSat->addRow();
            $tableSat->addCell(4800, ['bgColor' => 'F8FAFC'])->addText("  รวมเฉลี่ย{$dim['name']}", $cellBoldFont);
            $tableSat->addCell(1200, ['bgColor' => 'F8FAFC'])->addText(number_format($dim['mean'], 2), $cellBoldFont, ['alignment' => Jc::CENTER]);
            $tableSat->addCell(1200, ['bgColor' => 'F8FAFC'])->addText(number_format($dim['sd'], 2), $cellBoldFont, ['alignment' => Jc::CENTER]);
            $tableSat->addCell(1800, ['bgColor' => 'F8FAFC'])->addText($dim['quality'], $cellBoldFont, ['alignment' => Jc::CENTER]);
        }

        // Grand Total Row
        $tableSat->addRow();
        $tableSat->addCell(4800, ['bgColor' => 'E2EFDA'])->addText('สรุปผลการประเมินความพึงพอใจในภาพรวมทุกด้าน', $cellBlueFont);
        $tableSat->addCell(1200, ['bgColor' => 'E2EFDA'])->addText(number_format($survey['overallMean'], 2), $cellBlueFont, ['alignment' => Jc::CENTER]);
        $tableSat->addCell(1200, ['bgColor' => 'E2EFDA'])->addText(number_format($survey['overallSD'], 2), $cellBlueFont, ['alignment' => Jc::CENTER]);
        $tableSat->addCell(1800, ['bgColor' => 'E2EFDA'])->addText($survey['overallQuality'], $cellBlueFont, ['alignment' => Jc::CENTER]);

        // Section 5: Feedback & Suggestions
        $section->addTitle('๕. สรุปข้อคิดเห็นและข้อเสนอแนะของผู้เข้าร่วมโครงการ', 2);

        $section->addText('๕.๑ สิ่งที่ประทับใจในกิจกรรม/โครงการ:', $cellBoldFont);
        if (empty($survey['feedbacks']['impressions'])) {
            $section->addText('  - ผู้เข้าร่วมมีความประทับใจในบรรยากาศการเรียนรู้และการดูแลของคณะทำงาน', $cellBodyFont);
        } else {
            foreach (array_slice($survey['feedbacks']['impressions'], 0, 5) as $idx => $fb) {
                $section->addText("  • " . e($fb), $cellBodyFont);
            }
        }

        $section->addText('๕.๒ ข้อเสนอแนะเพื่อการปรับปรุงและพัฒนาในครั้งต่อไป:', $cellBoldFont, ['spaceBefore' => 80]);
        if (empty($survey['feedbacks']['suggestions'])) {
            $section->addText('  - ควรเพิ่มระยะเวลาในการฝึกปฏิบัติจริงให้มากขึ้น', $cellBodyFont);
        } else {
            foreach (array_slice($survey['feedbacks']['suggestions'], 0, 5) as $idx => $fb) {
                $section->addText("  • " . e($fb), $cellBodyFont);
            }
        }

        $section->addText('๕.๓ หัวข้อหรือกิจกรรมที่ผู้เรียนมีความสนใจต้องการให้จัดเพิ่มเติมในอนาคต:', $cellBoldFont, ['spaceBefore' => 80]);
        if (empty($survey['feedbacks']['futureTopics'])) {
            $section->addText('  - กิจกรรมอบรมทักษะอาชีพยุคดิจิทัล และการตลาดออนไลน์สำหรับชุมชน', $cellBodyFont);
        } else {
            foreach (array_slice($survey['feedbacks']['futureTopics'], 0, 5) as $idx => $fb) {
                $section->addText("  • " . e($fb), $cellBodyFont);
            }
        }

        // Section 6: Executive Conclusions & Recommendations
        $section->addTitle('๖. บทวิเคราะห์และข้อเสนอแนะเชิงนโยบายเสนอต่อผู้บริหาร', 2);
        $section->addText('๑) การบรรลุเป้าหมายและตัวชี้วัด (KPIs): การดำเนินโครงการบรรลุผลสำเร็จตามวัตถุประสงค์ มีผู้เข้าร่วมกิจกรรมคิดเป็นร้อยละ ' . ($stats['totalCheckIns'] > 0 ? '๑๐๐' : '๐') . ' ของกลุ่มเป้าหมายที่กำหนด และมีผลสัมฤทธิ์การประเมินความพึงพอใจอยู่ในระดับ ' . $survey['overallQuality'], $cellBodyFont);
        $section->addText('๒) จุดเด่นของโครงการ: มีการนำเทคโนโลยีดิจิทัล (ระบบ QR Code และ e-Learning Assessment) มาช่วยให้การจัดกิจกรรมมีความทันสมัย รวดเร็ว และตรวจสอบข้อมูลได้แบบ Real-time', $cellBodyFont);
        $section->addText('๓) ข้อเสนอแนะเชิงนโยบาย: ควรขยายผลรูปแบบกิจกรรมนี้ไปยังแหล่งเรียนรู้อื่นๆ ในพื้นที่อำเภอพร้าวอย่างต่อเนื่อง เพื่อส่งเสริมการเรียนรู้ตลอดชีวิตของประชาชนทุกช่วงวัย', $cellBodyFont, ['spaceAfter' => 200]);

        // Signatures Block
        $tableSign = $section->addTable([
            'borderSize'  => 0,
            'borderColor' => 'FFFFFF',
            'cellMargin'  => 60,
            'alignment'   => JcTable::CENTER,
        ]);
        $tableSign->addRow();
        $tableSign->addCell(4500)->addText("ลงชื่อ...........................................................\n(...........................................................)\nผู้รายงาน / ผู้รับผิดชอบโครงการ\nวันที่........เดือน.....................พ.ศ. ๒๕๖๙", $cellBodyFont, ['alignment' => Jc::CENTER]);
        $tableSign->addCell(4500)->addText("ลงชื่อ...........................................................\n(...........................................................)\nผู้อำนวยการ สกร.ระดับอำเภอพร้าว\nวันที่........เดือน.....................พ.ศ. ๒๕๖๙", $cellBodyFont, ['alignment' => Jc::CENTER]);

        // Save docx file to temporary storage and return response
        $tempFileName = 'Project_Report_' . preg_replace('/[^A-Za-z0-9_\-]/', '_', $cleanId) . '_' . date('Ymd_His') . '.docx';
        $tempPath = storage_path('app/' . $tempFileName);
        
        $objWriter = IOFactory::createWriter($phpWord, 'Word2007');
        $objWriter->save($tempPath);

        $downloadName = 'รายงานสรุปโครงการ_' . str_replace([' ', '/', '\\'], '_', $act['name']) . '.docx';

        return response()->download($tempPath, $downloadName, [
            'Content-Type'        => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'Content-Disposition' => 'attachment; filename="' . rawurlencode($downloadName) . '"',
        ])->deleteFileAfterSend(true);
    }

    /** Helper: Aggregate all report dataset for an activity */
    private function buildActivityReportData(string $cleanId): ?array
    {
        $activity = $this->findOrCreateActivityRecord($cleanId);
        $canonicalActId = $activity ? $activity->id : $cleanId;

        if (!$activity) {
            $qa = QuarterActivity::where('id', $cleanId)->first();
            if ($qa) {
                $activity = (object) [
                    'id'                  => $qa->id,
                    'name'                => $qa->activity_name,
                    'description'         => $qa->description,
                    'cover_image'         => $qa->image_url,
                    'location'            => $qa->location_name,
                    'tambon'              => $qa->tambon,
                    'institution_id'      => $qa->institution_id ?? 'INS_PHRAO',
                    'check_in_points'     => 20,
                    'quiz_pass_score'     => 80,
                    'quiz_ids'            => [],
                    'certificate_template'=> null,
                ];
            }
        }

        if (!$activity) {
            return null;
        }

        // 1. Activity Info
        $actInfo = [
            'id'            => $canonicalActId,
            'name'          => $activity->name ?? 'กิจกรรมสถานศึกษา',
            'description'   => $activity->description ?? '',
            'location'      => $activity->location ?? 'สกร.ระดับอำเภอพร้าว',
            'tambon'        => $activity->tambon ?? 'อำเภอพร้าว',
            'coverImage'    => $activity->cover_image ?? '',
            'points'        => (int) ($activity->check_in_points ?? 20),
            'quizPassScore' => (int) ($activity->quiz_pass_score ?? 80),
            'date'          => $activity->event_date ?? '',
        ];

        // 2. Institution Info
        $inst = Institution::where('id', $activity->institution_id ?? 'INS_PHRAO')->first();
        $instInfo = [
            'id'   => $inst ? $inst->id : 'INS_PHRAO',
            'name' => $inst ? $inst->name : 'ศูนย์ส่งเสริมการเรียนรู้ระดับอำเภอพร้าว',
        ];

        // 3. Check-ins & Demographics
        $checkins = ActivityCheckIn::where('activity_id', $canonicalActId)
            ->orWhereRaw('LOWER(activity_id) = ?', [strtolower($canonicalActId)])
            ->get();

        $checkinUsernames = $checkins->pluck('username')->unique()->values();
        $users = User::whereIn('username', $checkinUsernames)->get()->keyBy('username');

        $genderCounts = ['ชาย' => 0, 'หญิง' => 0, 'อื่นๆ / ไม่ระบุ' => 0];
        $ageCounts = [
            'ต่ำกว่า 15 ปี'   => 0,
            '15 - 25 ปี'     => 0,
            '26 - 40 ปี'     => 0,
            '41 - 59 ปี'     => 0,
            '60 ปีขึ้นไป'     => 0,
        ];
        $occCounts = [
            'นักเรียน / นักศึกษา' => 0,
            'ประชาชนทั่วไป'       => 0,
            'เกษตรกร'             => 0,
            'ค้าขาย / ธุรกิจส่วนตัว' => 0,
            'ข้าราชการ / พนักงานรัฐ' => 0,
            'รับจ้างทั่วไป / อื่นๆ'   => 0,
        ];
        $tambonCounts = [];

        foreach ($checkins as $c) {
            $u = $users[$c->username] ?? null;
            $g = $u?->gender ?? 'ไม่ระบุ';
            if (str_contains($g, 'ชาย')) $genderCounts['ชาย']++;
            elseif (str_contains($g, 'หญิง')) $genderCounts['หญิง']++;
            else $genderCounts['อื่นๆ / ไม่ระบุ']++;

            $age = $u?->age_group ?? '';
            if (str_contains($age, '<15') || str_contains($age, 'ต่ำกว่า 15')) $ageCounts['ต่ำกว่า 15 ปี']++;
            elseif (str_contains($age, '15') || str_contains($age, '20') || str_contains($age, '25')) $ageCounts['15 - 25 ปี']++;
            elseif (str_contains($age, '26') || str_contains($age, '30') || str_contains($age, '35') || str_contains($age, '40')) $ageCounts['26 - 40 ปี']++;
            elseif (str_contains($age, '41') || str_contains($age, '45') || str_contains($age, '50') || str_contains($age, '59')) $ageCounts['41 - 59 ปี']++;
            elseif (str_contains($age, '60') || str_contains($age, 'สูงอายุ')) $ageCounts['60 ปีขึ้นไป']++;
            else $ageCounts['15 - 25 ปี']++;

            $occ = $u?->occupation ?? 'นักเรียน / นักศึกษา';
            if (str_contains($occ, 'นักเรียน') || str_contains($occ, 'นักศึกษา')) $occCounts['นักเรียน / นักศึกษา']++;
            elseif (str_contains($occ, 'เกษตร')) $occCounts['เกษตรกร']++;
            elseif (str_contains($occ, 'ค้าขาย') || str_contains($occ, 'ธุรกิจ')) $occCounts['ค้าขาย / ธุรกิจส่วนตัว']++;
            elseif (str_contains($occ, 'ราชการ') || str_contains($occ, 'รัฐ')) $occCounts['ข้าราชการ / พนักงานรัฐ']++;
            elseif (str_contains($occ, 'ประชาชน')) $occCounts['ประชาชนทั่วไป']++;
            else $occCounts['รับจ้างทั่วไป / อื่นๆ']++;

            $t = $u?->tambon ?? $activity->tambon ?? 'ไม่ระบุ';
            $tambonCounts[$t] = ($tambonCounts[$t] ?? 0) + 1;
        }

        $onsiteCheckinsCount = $checkins->count();
        $onlineQuizTakers = QuizLog::where(function($q) use ($canonicalActId) {
                $q->where('activity_id', $canonicalActId)
                  ->orWhereRaw('LOWER(activity_id) = ?', [strtolower($canonicalActId)]);
            })
            ->where('attendance_type', 'online')
            ->count();

        $totalCombinedLearners = $onsiteCheckinsCount + $onlineQuizTakers;

        $participation = [
            'totalCheckIns'         => $checkins->count(),
            'uniqueUsers'           => $checkinUsernames->count(),
            'onsiteCheckIns'        => $onsiteCheckinsCount,
            'onlineLearners'        => $onlineQuizTakers,
            'totalCombinedLearners' => $totalCombinedLearners,
            'demographics'  => [
                'gender'     => $genderCounts,
                'ageGroup'   => $ageCounts,
                'occupation' => $occCounts,
                'tambon'     => $tambonCounts,
            ],
        ];

        // 4. Quiz Results
        $quizLogs = QuizLog::where(function($q) use ($canonicalActId) {
                $q->where('activity_id', $canonicalActId)
                  ->orWhereRaw('LOWER(activity_id) = ?', [strtolower($canonicalActId)]);
            })
            ->get();

        $quizTakers = $quizLogs->count();
        $quizPasses = $quizLogs->where('status', 'pass')->count();
        $scores = $quizLogs->pluck('score')->map(fn($s) => (float)$s)->all();

        $onsiteQuizPasses = $quizLogs->where('attendance_type', 'onsite')->where('status', 'pass')->count();
        $onlineQuizPasses = $quizLogs->where('attendance_type', 'online')->where('status', 'pass')->count();

        $avgQuizScore = count($scores) > 0 ? round(array_sum($scores) / count($scores), 1) : 0;
        $maxQuizScore = count($scores) > 0 ? max($scores) : 0;
        $minQuizScore = count($scores) > 0 ? min($scores) : 0;
        $sdQuizScore  = $this->calculateSD($scores, $avgQuizScore);
        $passRate     = $quizTakers > 0 ? round(($quizPasses / $quizTakers) * 100, 1) : 0;

        $onsiteCerts = Certificate::where(function($q) use ($canonicalActId) {
                $q->where('activity_id', $canonicalActId)
                  ->orWhereRaw('LOWER(activity_id) = ?', [strtolower($canonicalActId)]);
            })
            ->where('attendance_type', 'onsite')
            ->count();

        $onlineCerts = Certificate::where(function($q) use ($canonicalActId) {
                $q->where('activity_id', $canonicalActId)
                  ->orWhereRaw('LOWER(activity_id) = ?', [strtolower($canonicalActId)]);
            })
            ->where('attendance_type', 'online')
            ->count();

        $certsIssued = $onsiteCerts + $onlineCerts;

        $quizStats = [
            'totalTakers'       => $quizTakers,
            'passedCount'       => $quizPasses,
            'failedCount'       => $quizTakers - $quizPasses,
            'passRate'          => $passRate,
            'avgScore'          => $avgQuizScore,
            'maxScore'          => $maxQuizScore,
            'minScore'          => $minQuizScore,
            'sd'                => $sdQuizScore,
            'certsIssued'       => $certsIssued,
            'onsiteCerts'       => $onsiteCerts,
            'onlineCerts'       => $onlineCerts,
            'onsiteQuizPasses'  => $onsiteQuizPasses,
            'onlineQuizPasses'  => $onlineQuizPasses,
        ];

        // 5. Satisfaction Survey Evaluations
        $evals = ActivityEvaluation::where(function($q) use ($canonicalActId) {
                $q->where('activity_id', $canonicalActId)
                  ->orWhereRaw('LOWER(activity_id) = ?', [strtolower($canonicalActId)]);
            })
            ->get();

        $surveyQuestions = [
            'q1' => ['num' => 1, 'dim' => 'dim1', 'title' => 'การประชาสัมพันธ์และขั้นตอนการลงทะเบียนเข้าร่วมกิจกรรม มีความสะดวก รวดเร็ว'],
            'q2' => ['num' => 2, 'dim' => 'dim1', 'title' => 'ระยะเวลา กำหนดการ และสถานที่ในการจัดกิจกรรมมีความเหมาะสม'],
            'q3' => ['num' => 3, 'dim' => 'dim2', 'title' => 'วิทยากรมีความรู้ ความเชี่ยวชาญ และมีเทคนิคการถ่ายทอดที่เข้าใจง่าย'],
            'q4' => ['num' => 4, 'dim' => 'dim2', 'title' => 'มีการเปิดโอกาสให้ผู้เข้าร่วมได้ซักถาม แลกเปลี่ยนเรียนรู้ และมีส่วนร่วม'],
            'q5' => ['num' => 5, 'dim' => 'dim3', 'title' => 'เนื้อหาของกิจกรรมมีความน่าสนใจ สอดคล้องกับความต้องการและทันสมัย'],
            'q6' => ['num' => 6, 'dim' => 'dim3', 'title' => 'สื่อ เอกสาร อุปกรณ์ หรือนวัตกรรมที่ใช้ประกอบกิจกรรมมีความพร้อมและเหมาะสม'],
            'q7' => ['num' => 7, 'dim' => 'dim4', 'title' => 'ได้รับความรู้ ความเข้าใจ และพัฒนาทักษะใหม่จากกิจกรรมนี้'],
            'q8' => ['num' => 8, 'dim' => 'dim4', 'title' => 'สามารถนำความรู้และทักษะที่ได้รับไปปรับใช้ในการเรียน การทำงาน หรือชีวิตประจำวัน'],
            'q9' => ['num' => 9, 'dim' => 'dim4', 'title' => 'ความพึงพอใจในภาพรวมต่อการเข้าร่วมกิจกรรม/โครงการนี้'],
        ];

        $dimensionNames = [
            'dim1' => 'ด้านที่ 1: ด้านกระบวนการและขั้นตอนการจัดกิจกรรม',
            'dim2' => 'ด้านที่ 2: ด้านวิทยากรและผู้ถ่ายทอดความรู้',
            'dim3' => 'ด้านที่ 3: ด้านเนื้อหาและสื่ออุปกรณ์การเรียนรู้',
            'dim4' => 'ด้านที่ 4: ด้านประโยชน์และการนำไปประยุกต์ใช้',
        ];

        $qValues = [];
        foreach (array_keys($surveyQuestions) as $k) {
            $qValues[$k] = [];
        }

        $allOverallScores = [];
        $impressionsList  = [];
        $suggestionsList  = [];
        $futureTopicsList = [];

        foreach ($evals as $ev) {
            $allOverallScores[] = (float) $ev->overall_score;
            $ratings = is_array($ev->ratings) ? $ev->ratings : json_decode($ev->ratings ?? '{}', true);

            foreach ($surveyQuestions as $k => $info) {
                if (isset($ratings[$k])) {
                    $val = (float) $ratings[$k];
                    if ($val >= 1 && $val <= 5) {
                        $qValues[$k][] = $val;
                    }
                }
            }

            if (!empty($ev->feedback_impressions))   $impressionsList[]  = $ev->feedback_impressions;
            if (!empty($ev->feedback_suggestions))   $suggestionsList[]  = $ev->feedback_suggestions;
            if (!empty($ev->feedback_future_topics)) $futureTopicsList[] = $ev->feedback_future_topics;
        }

        // Calculate dimension groupings
        $dimensions = [];
        foreach ($dimensionNames as $dKey => $dName) {
            $dimItems = [];
            $dimScores = [];

            foreach ($surveyQuestions as $qKey => $qMeta) {
                if ($qMeta['dim'] === $dKey) {
                    $vals = $qValues[$qKey];
                    $mean = count($vals) > 0 ? round(array_sum($vals) / count($vals), 2) : 5.00;
                    $sd   = $this->calculateSD($vals, $mean);
                    $quality = $this->calculateQualityLevel($mean);

                    $dimItems[] = [
                        'key'     => $qKey,
                        'num'     => $qMeta['num'],
                        'title'   => $qMeta['title'],
                        'mean'    => $mean,
                        'sd'      => $sd,
                        'quality' => $quality,
                        'count'   => count($vals),
                    ];
                    $dimScores = array_merge($dimScores, $vals);
                }
            }

            $dimMean = count($dimScores) > 0 ? round(array_sum($dimScores) / count($dimScores), 2) : 5.00;
            $dimSD   = $this->calculateSD($dimScores, $dimMean);
            $dimQuality = $this->calculateQualityLevel($dimMean);

            $dimensions[] = [
                'key'     => $dKey,
                'name'    => $dName,
                'mean'    => $dimMean,
                'sd'      => $dimSD,
                'quality' => $dimQuality,
                'items'   => $dimItems,
            ];
        }

        $overallMean = count($allOverallScores) > 0 ? round(array_sum($allOverallScores) / count($allOverallScores), 2) : 5.00;
        $overallSD   = $this->calculateSD($allOverallScores, $overallMean);
        $overallQuality = $this->calculateQualityLevel($overallMean);
        $overallPercent = round(($overallMean / 5.0) * 100, 1);

        $satisfaction = [
            'totalRespondents' => $evals->count(),
            'overallMean'      => $overallMean,
            'overallSD'        => $overallSD,
            'overallQuality'   => $overallQuality,
            'overallPercent'   => $overallPercent,
            'dimensions'       => $dimensions,
            'feedbacks'        => [
                'impressions'  => array_values(array_unique($impressionsList)),
                'suggestions'  => array_values(array_unique($suggestionsList)),
                'futureTopics' => array_values(array_unique($futureTopicsList)),
            ],
        ];

        return [
            'activity'      => $actInfo,
            'institution'   => $instInfo,
            'participation' => $participation,
            'quiz'          => $quizStats,
            'satisfaction'  => $satisfaction,
        ];
    }

    private function calculateQualityLevel(float $score): string
    {
        if ($score >= 4.50) return 'มากที่สุด (Excellent)';
        if ($score >= 3.50) return 'มาก (Good)';
        if ($score >= 2.50) return 'ปานกลาง (Moderate)';
        if ($score >= 1.50) return 'น้อย (Fair)';
        return 'น้อยที่สุด (Poor)';
    }

    private function calculateSD(array $values, float $mean): float
    {
        $count = count($values);
        if ($count <= 1) return 0.00;
        $sumSquares = 0.0;
        foreach ($values as $v) {
            $sumSquares += pow((float)$v - $mean, 2);
        }
        return round(sqrt($sumSquares / ($count - 1)), 2);
    }

    private function activityToFrontend(Activity $activity): array
    {
        $quizzes = is_array($activity->quiz_ids) ? $activity->quiz_ids : json_decode($activity->quiz_ids ?? '[]', true);
        $template = is_array($activity->certificate_template) ? $activity->certificate_template : json_decode($activity->certificate_template ?? 'null', true);
        $checkInsCount = ActivityCheckIn::where('activity_id', $activity->id)->count();

        $learningMaterials = is_array($activity->learning_materials) ? $activity->learning_materials : (json_decode($activity->learning_materials ?? '[]', true) ?: []);
        $externalLinks = is_array($activity->external_links) ? $activity->external_links : (json_decode($activity->external_links ?? '[]', true) ?: []);

        return [
            'activityId'          => $activity->id,
            'id'                  => $activity->id,
            'name'                => $activity->name,
            'activityName'        => $activity->name,
            'institutionId'       => $activity->institution_id ?? 'INS_PHRAO',
            'details'             => $activity->description ?? '',
            'description'         => $activity->description ?? '',
            'coverImage'          => $activity->cover_image ?? '',
            'imageUrl'            => $activity->cover_image ?? '',
            'location'            => $activity->location ?? '',
            'locationName'        => $activity->location ?? '',
            'tambon'              => $activity->tambon ?? '',
            'points'              => (int) ($activity->check_in_points ?? 20),
            'checkInPoints'       => (int) ($activity->check_in_points ?? 20),
            'quizPassScore'       => (int) ($activity->quiz_pass_score ?? 80),
            'status'              => $activity->status ?? 'Active',
            'quizzes'             => $quizzes ?? [],
            'quizzesCount'        => count($quizzes ?? []),
            'certificateTemplate' => $template,
            'hasCertificate'      => !empty($template),
            'checkInsCount'       => $checkInsCount,
            'learningMaterials'   => $learningMaterials,
            'externalLinks'       => $externalLinks,
            'videoUrl'            => $activity->video_url ?? '',
            'isOnlineEnabled'     => (bool) ($activity->is_online_enabled ?? true),
            'onlineDescription'   => $activity->online_description ?? '',
        ];
    }

    private function quarterActivityToFrontend(\App\Models\QuarterActivity $qa): array
    {
        $descData = [];
        if (!empty($qa->description)) {
            $decoded = json_decode($qa->description, true);
            if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                $descData = $decoded;
            } else {
                $descData = ['description' => $qa->description];
            }
        }

        $checkInsCount = ActivityCheckIn::where('activity_id', $qa->id)->count();
        $learningMaterials = is_array($qa->learning_materials) ? $qa->learning_materials : (json_decode($qa->learning_materials ?? '[]', true) ?: []);
        $externalLinks = is_array($qa->external_links) ? $qa->external_links : (json_decode($qa->external_links ?? '[]', true) ?: []);

        return [
            'activityId'        => $qa->id,
            'id'                => $qa->id,
            'institutionId'     => $qa->institution_id ?? 'INS_PHRAO',
            'activityName'      => $qa->activity_name,
            'name'              => $qa->activity_name,
            'imageUrl'          => $qa->image_url,
            'locationName'      => $qa->location_name,
            'tambon'            => $qa->tambon,
            'quarter'           => (int) $qa->quarter,
            'year'              => (int) $qa->year,
            'status'            => $qa->status,
            'displayOrder'      => (int) $qa->display_order,
            'description'       => $descData['description'] ?? '',
            'activityDate'      => $descData['activityDate'] ?? '',
            'mapLink'           => $descData['mapLink'] ?? '',
            'benefit'           => $descData['benefit'] ?? '',
            'capacity'          => $descData['capacity'] ?? '',
            'contactName'       => $descData['contactName'] ?? '',
            'contactPhone'      => $descData['contactPhone'] ?? '',
            'checkInPoints'     => (int) ($descData['checkInPoints'] ?? 20),
            'checkInsCount'     => $checkInsCount,
            'learningMaterials' => $learningMaterials,
            'externalLinks'     => $externalLinks,
            'videoUrl'          => $qa->video_url ?? '',
            'isOnlineEnabled'   => (bool) ($qa->is_online_enabled ?? true),
            'onlineDescription' => $qa->online_description ?? '',
        ];
    }

    private function formatThaiDateLong(string $dateStr): string
    {
        if (preg_match('/^(\d{4})-(\d{2})-(\d{2})/', $dateStr, $m)) {
            $y = (int) $m[1] + 543;
            $mNames = ['', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
            $month = $mNames[(int) $m[2]] ?? $m[2];
            $d = (int) $m[3];
            return "{$d} {$month} พ.ศ. {$y}";
        }
        return $dateStr;
    }
}

