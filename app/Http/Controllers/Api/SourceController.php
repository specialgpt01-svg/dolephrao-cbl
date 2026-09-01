<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Source;
use App\Models\Base;
use App\Models\Quiz;
use App\Models\Setting;
use App\Services\AuthService;
use App\Services\CacheService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SourceController extends Controller
{
    /** getSources — รายชื่อแหล่งเรียนรู้ทั้งหมด (cached 30 นาที) */
    public function getSources(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        $institutionId = trim($request->input('institutionId') ?? $request->input('institution_id') ?? '');

        $query = Source::with(['bases' => fn($q) => $q->orderBy('display_order')])
            ->orderBy('name');

        if ($institutionId && $institutionId !== 'ALL' && $institutionId !== 'ทั้งหมด') {
            $query->where('institution_id', $institutionId);
        }

        $data = $query->get()->map(fn($s) => $s->toListArray())->toArray();

        if (!$data) return response()->json(null);
        return response()->json($data);
    }

    /** getSourceDetail — รายละเอียดแหล่งเรียนรู้ */
    public function getSourceDetail(Request $request): JsonResponse
    {
        $sourceId = trim($request->input('sourceId') ?? $request->input('SourceID') ?? '');
        if (!$sourceId) {
            return response()->json(['status' => 'error', 'message' => 'ไม่พบรหัสแหล่งเรียนรู้']);
        }

        $source = Source::with([
            'bases' => fn($q) => $q->orderBy('display_order'),
            'bases.quizzes' => fn($q) => $q->orderBy('display_order'),
            'quizzes' => fn($q) => $q->orderBy('display_order'),
        ])->find($sourceId);
        if (!$source) {
            return response()->json(['status' => 'error', 'message' => 'ไม่พบข้อมูลแหล่งเรียนรู้']);
        }

        return response()->json(['status' => 'success', 'source' => $source->toDetailArray()]);
    }

    /** getMapSources — ข้อมูลสำหรับแสดงบนแผนที่ (เปิดให้ผู้เรียนดูได้ทุกอำเภอ) */
    public function getMapSources(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        $institutionId = trim($request->input('institutionId') ?? $request->input('institution_id') ?? '');

        $query = Source::query();
        if ($institutionId && $institutionId !== 'ALL' && $institutionId !== 'ทั้งหมด') {
            $query->where('institution_id', $institutionId);
        }

        $data = $query->get()->map(fn($s) => [
            'SourceID'        => $s->id,
            'TambonName'      => $s->tambon,
            'SourceName'      => $s->name,
            'institutionId'   => $s->institution_id ?? 'INS_PHRAO',
            'institution_id'  => $s->institution_id ?? 'INS_PHRAO',
            'CoverImage'      => $s->cover_image ?? '',
            'Latitude'        => $s->latitude ?? '',
            'Longitude'       => $s->longitude ?? '',
            'Description'     => ($s->info['history'] ?? '') ?: ($s->description ?? ''),
            'Views'           => (int) $s->views,
            'subjectCategory' => $s->subject_category ?? '',
            'creditHours'     => (float) $s->credit_hours,
            'sourceType'      => $s->info['source_type'] ?? '',
        ]);

        if ($data->isEmpty()) return response()->json(null);
        return response()->json($data);
    }

    /** viewSource — เพิ่ม view count */
    public function viewSource(Request $request): JsonResponse
    {
        $sourceId = trim($request->input('sourceId') ?? '');
        if (!$sourceId) return response()->json(['status' => 'error', 'message' => 'ไม่พบรหัสแหล่งเรียนรู้']);

        $source = Source::find($sourceId);
        if (!$source) return response()->json(['status' => 'error', 'message' => 'ไม่พบแหล่งเรียนรู้']);

        DB::table('sources')->where('id', $sourceId)->increment('views');

        return response()->json(['status' => 'success', 'views' => $source->views + 1]);
    }

    /** getAdminSources */
    public function getAdminSources(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor || !in_array($actor['role'], ['admin', 'teacher'])) {
            return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์เข้าถึงข้อมูลแหล่งเรียนรู้', 'data' => []]);
        }

        $institutionId = trim($request->input('institutionId') ?? $request->input('institution_id') ?? $actor['institution_id'] ?? 'INS_PHRAO');
        
        if (!AuthService::isSuperAdmin($actor)) {
            $institutionId = $actor['institution_id'] ?? 'INS_PHRAO';
        }

        $query = Source::query();

        if ($institutionId && $institutionId !== 'ALL' && $institutionId !== 'ทั้งหมด') {
            $query->where('institution_id', $institutionId);
        }
        if ($actor['role'] === 'teacher') {
            $cleanTambon = AuthService::normalizeTambon($actor['tambon'] ?? '');
            if ($cleanTambon && $cleanTambon !== 'all') {
                $query->where(function($q) use ($actor, $cleanTambon) {
                    $q->where('tambon', $actor['tambon'])
                      ->orWhere('tambon', 'LIKE', '%' . $cleanTambon . '%');
                });
            }
        }

        $data = $query->orderBy('name')->get()->map(fn($s) => [
            'SourceID'            => $s->id,
            'SourceName'          => $s->name,
            'TambonName'          => $s->tambon,
            'institutionId'       => $s->institution_id ?? 'INS_PHRAO',
            'institution_id'      => $s->institution_id ?? 'INS_PHRAO',
            'CoverImageURL'       => $s->cover_image ?? '',
            'Latitude'            => $s->latitude ?? '',
            'Longitude'           => $s->longitude ?? '',
            'subjectCategory'     => $s->subject_category ?? '',
            'creditHours'         => (float) $s->credit_hours,
            'info'                => [
                'history'    => $s->info['history'] ?? '',
                'contact'    => $s->info['contact'] ?? '',
                'gps'        => $s->info['gps'] ?? '',
                'gallery'    => $s->info['gallery'] ?? '',
                'external'   => $s->info['external'] ?? '',
                'result'     => $s->info['result'] ?? '',
                'facilities' => $s->info['facilities'] ?? [],
            ],
            'facilities'          => $s->info['facilities'] ?? null,
            'evaluation'          => $s->info['evaluation'] ?? null,
            'sourceType'          => $s->info['source_type'] ?? '',
            'certificateTemplate' => $s->cert_template,
        ]);

        return response()->json(['status' => 'success', 'data' => $data]);
    }

    /** getAdminBasesBySource */
    public function getAdminBasesBySource(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor || !in_array($actor['role'], ['admin', 'teacher'])) {
            return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์', 'data' => []]);
        }

        $sourceId = trim($request->input('sourceId') ?? '');
        if (!$sourceId) return response()->json(['status' => 'error', 'message' => 'กรุณาระบุรหัสแหล่งเรียนรู้', 'data' => []]);

        $bases = Base::where('source_id', $sourceId)
            ->orderBy('display_order')
            ->get()
            ->map(fn($b) => $b->toAdminArray());

        return response()->json(['status' => 'success', 'data' => $bases]);
    }

    /**
     * Helper to automatically convert base64 image data URLs into stored files
     */
    protected function saveBase64ImageFile(?string $dataUrl, string $prefix = 'source_cover'): string
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

    /** saveAdminSource — สร้าง/แก้ไขแหล่งเรียนรู้ */
    public function saveAdminSource(Request $request): JsonResponse
    {
        try {
            $actor = AuthService::buildActorFromRequest($request);
            if (!$actor || !in_array($actor['role'], ['admin', 'teacher'])) {
                return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์จัดการแหล่งเรียนรู้'], 403);
            }

            $sourceId    = trim((string) ($request->input('sourceId') ?? $request->input('SourceID') ?? $request->input('id') ?? ''));
            $sourceName  = trim((string) ($request->input('sourceName') ?? $request->input('SourceName') ?? $request->input('name') ?? ''));
            $tambonName  = trim((string) ($request->input('tambonName') ?? $request->input('TambonName') ?? $request->input('tambon') ?? ''));
            $rawCover    = (string) ($request->input('coverImageUrl') ?? $request->input('coverImage') ?? $request->input('CoverImageURL') ?? $request->input('CoverImage') ?? '');
            $coverImage  = $this->saveBase64ImageFile($rawCover, 'source_cover');
            $description = (string) ($request->input('description') ?? $request->input('Description') ?? '');
            $subjectCat  = (string) ($request->input('subjectCategory') ?? $request->input('subject_category') ?? '');
            $credits     = (float) ($request->input('creditHours') ?? $request->input('credit_hours') ?? 0);

            $mode = strtolower(trim((string) ($request->input('mode') ?? '')));
            if (!$mode) {
                $mode = ($sourceId && Source::find($sourceId)) ? 'update' : 'create';
            }

            if (!$sourceName || !$tambonName) {
                return response()->json(['status' => 'error', 'message' => 'กรุณากรอกชื่อแหล่งเรียนรู้และตำบลให้ครบ']);
            }

            $lat = trim((string) ($request->input('latitude') ?? ''));
            $lng = trim((string) ($request->input('longitude') ?? ''));
            if (empty($lat) || empty($lng)) {
                $rawInfoParam = $request->input('info');
                $gpsFromInfo = is_array($rawInfoParam) ? ($rawInfoParam['gps'] ?? '') : '';
                $coords = trim((string) ($request->input('coordinates') ?? $gpsFromInfo));
                if ($coords && str_contains($coords, ',')) {
                    $parts = explode(',', $coords);
                    if (count($parts) === 2) {
                        $lat = trim($parts[0]);
                        $lng = trim($parts[1]);
                    }
                }
            }

            if ($actor['role'] === 'teacher') {
                $teacherClean = AuthService::normalizeTambon($actor['tambon'] ?? '');
                $targetClean  = AuthService::normalizeTambon($tambonName);
                if ($teacherClean !== $targetClean) {
                    return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์สร้างหรือแก้ไขแหล่งเรียนรู้นอกพื้นที่']);
                }
            }

            $rawFac = $request->input('facilities');
            if (is_array($rawFac)) {
                $facilities = $rawFac;
            } elseif (is_string($rawFac) && str_starts_with(trim($rawFac), '{')) {
                $facilities = json_decode($rawFac, true) ?? [];
            } else {
                $facilities = [
                    'capacity_people'    => (int) ($request->input('capacityPeople') ?? 0),
                    'parking_spaces'     => (int) ($request->input('parkingSpaces') ?? 0),
                    'restrooms'          => (int) ($request->input('restrooms') ?? 0),
                    'tables_chairs'      => (int) ($request->input('tablesChairs') ?? 0),
                    'travel_info'        => trim((string) ($request->input('travelInfo') ?? '')),
                    'main_road_distance' => trim((string) ($request->input('mainRoadDistance') ?? '')),
                    'social_media'       => [
                        'facebook' => trim((string) ($request->input('socialFacebook') ?? '')),
                        'line'     => trim((string) ($request->input('socialLine') ?? '')),
                        'website'  => trim((string) ($request->input('socialWebsite') ?? '')),
                        'tiktok'   => trim((string) ($request->input('socialTiktok') ?? '')),
                    ],
                    'note'               => is_string($rawFac) ? trim($rawFac) : ''
                ];
            }

            $targetInstId = trim((string) ($request->input('institutionId') ?? $request->input('institution_id') ?? ''));
            if (!$targetInstId || !AuthService::isSuperAdmin($actor)) {
                $targetInstId = $actor['institution_id'] ?? 'INS_PHRAO';
            }
            if ($targetInstId === 'ALL') $targetInstId = 'INS_PHRAO';

            $rawInfo = $request->input('info');
            if (!is_array($rawInfo)) {
                $rawInfo = (is_string($rawInfo) && str_starts_with(trim($rawInfo), '{')) ? (json_decode($rawInfo, true) ?? []) : [];
            }

            $history = isset($rawInfo['history']) ? $rawInfo['history'] : ($request->input('history') ?? '');
            $contact = isset($rawInfo['contact']) ? $rawInfo['contact'] : ($request->input('contact') ?? '');
            $gps     = isset($rawInfo['gps']) ? $rawInfo['gps'] : ($request->input('gps') ?? ($request->input('coordinates') ?? ''));
            $gallery = isset($rawInfo['gallery']) ? $rawInfo['gallery'] : ($request->input('gallery') ?? '');
            $external= isset($rawInfo['external']) ? $rawInfo['external'] : ($request->input('external') ?? '');
            $result  = isset($rawInfo['result']) ? $rawInfo['result'] : ($request->input('result') ?? '');
            $sourceType = isset($rawInfo['source_type']) ? $rawInfo['source_type'] : ($request->input('sourceType') ?? ($request->input('source_type') ?? 'สถานที่'));

            // 6 Standards Section 6 attributes
            $address         = $request->input('address') ?? ($rawInfo['address'] ?? '');
            $openingHours    = $request->input('openingHours') ?? ($request->input('opening_hours') ?? ($rawInfo['opening_hours'] ?? ''));
            $managerName     = $request->input('managerName') ?? ($request->input('manager_name') ?? ($rawInfo['manager_name'] ?? ''));
            $networkPartners = $request->input('networkPartners') ?? ($request->input('network_partners') ?? ($rawInfo['network_partners'] ?? ''));
            $operationPlan   = $request->input('operationPlan') ?? ($request->input('operation_plan') ?? ($rawInfo['operation_plan'] ?? ''));
            $wisdomExpertName= $request->input('wisdomExpertName') ?? ($request->input('wisdom_expert_name') ?? ($rawInfo['wisdom_expert_name'] ?? ''));
            $expertSpecialty = $request->input('expertSpecialty') ?? ($request->input('expert_specialty') ?? ($rawInfo['expert_specialty'] ?? ''));
            $learningMedia   = $request->input('learningMedia') ?? ($request->input('learning_media') ?? ($rawInfo['learning_media'] ?? ''));
            $targetLearners  = $request->input('targetLearners') ?? ($request->input('target_learners') ?? ($rawInfo['target_learners'] ?? ''));
            $assessmentTools = $request->input('assessmentTools') ?? ($request->input('assessment_tools') ?? ($rawInfo['assessment_tools'] ?? ''));
            $followupPlan    = $request->input('followupPlan') ?? ($request->input('followup_plan') ?? ($rawInfo['followup_plan'] ?? ''));

            if ($mode === 'create') {
                if (!$sourceId) {
                    // auto-generate: SRC + max+1
                    $max = Source::selectRaw("MAX(CAST(SUBSTRING(id, 4) AS UNSIGNED)) as max_no")->value('max_no') ?? 0;
                    $sourceId = 'SRC' . str_pad($max + 1, 4, '0', STR_PAD_LEFT);
                }
                $coverPosition = trim((string) ($request->input('coverPosition') ?? $request->input('cover_position') ?? ''));

                Source::create([
                    'id'               => $sourceId,
                    'institution_id'   => $targetInstId,
                    'name'             => $sourceName,
                    'tambon'           => AuthService::normalizeTambon($tambonName),
                    'cover_image'      => $coverImage,
                    'latitude'         => $lat,
                    'longitude'        => $lng,
                    'description'      => $description,
                    'subject_category' => $subjectCat,
                    'credit_hours'     => $credits,
                    'info'             => [
                        'history'          => $history,
                        'contact'          => $contact,
                        'gps'              => $gps,
                        'gallery'          => $gallery,
                        'external'         => $external,
                        'result'           => $result,
                        'source_type'      => $sourceType,
                        'facilities'       => $facilities,
                        'cover_position'   => $coverPosition ?: '50% 50%',
                        'address'          => $address,
                        'opening_hours'    => $openingHours,
                        'manager_name'     => $managerName,
                        'network_partners' => $networkPartners,
                        'operation_plan'   => $operationPlan,
                        'wisdom_expert_name'=> $wisdomExpertName,
                        'expert_specialty' => $expertSpecialty,
                        'learning_media'   => $learningMedia,
                        'target_learners'  => $targetLearners,
                        'assessment_tools' => $assessmentTools,
                        'followup_plan'    => $followupPlan,
                    ],
                    'cert_template' => $request->input('certificateTemplate'),
                ]);
            } else {
                $source = Source::find($sourceId);
                if (!$source) return response()->json(['status' => 'error', 'message' => 'ไม่พบแหล่งเรียนรู้ที่ต้องการแก้ไข']);

                $coverPosition = trim((string) ($request->input('coverPosition') ?? $request->input('cover_position') ?? ''));

                $info = is_array($source->info) ? $source->info : ((is_string($source->info) && str_starts_with(trim($source->info), '{')) ? (json_decode($source->info, true) ?? []) : []);
                $info['history']          = $history ?: ($info['history'] ?? '');
                $info['contact']          = $contact ?: ($info['contact'] ?? '');
                $info['gps']              = $gps ?: ($info['gps'] ?? '');
                $info['gallery']          = $gallery ?: ($info['gallery'] ?? '');
                $info['external']         = $external ?: ($info['external'] ?? '');
                $info['result']           = $result ?: ($info['result'] ?? '');
                $info['source_type']      = $sourceType ?: ($info['source_type'] ?? 'สถานที่');
                $info['facilities']       = $facilities;
                if ($coverPosition) {
                    $info['cover_position'] = $coverPosition;
                }
                if ($address !== '')          $info['address'] = $address;
                if ($openingHours !== '')     $info['opening_hours'] = $openingHours;
                if ($managerName !== '')      $info['manager_name'] = $managerName;
                if ($networkPartners !== '')  $info['network_partners'] = $networkPartners;
                if ($operationPlan !== '')    $info['operation_plan'] = $operationPlan;
                if ($wisdomExpertName !== '') $info['wisdom_expert_name'] = $wisdomExpertName;
                if ($expertSpecialty !== '')  $info['expert_specialty'] = $expertSpecialty;
                if ($learningMedia !== '')    $info['learning_media'] = $learningMedia;
                if ($targetLearners !== '')   $info['target_learners'] = $targetLearners;
                if ($assessmentTools !== '')  $info['assessment_tools'] = $assessmentTools;
                if ($followupPlan !== '')     $info['followup_plan'] = $followupPlan;

                $updateFields = [
                    'name'             => $sourceName,
                    'tambon'           => AuthService::normalizeTambon($tambonName),
                    'cover_image'      => $coverImage ?: $source->cover_image,
                    'latitude'         => $lat ?: $source->latitude,
                    'longitude'        => $lng ?: $source->longitude,
                    'description'      => $description ?: $source->description,
                    'subject_category' => $subjectCat ?: $source->subject_category,
                    'credit_hours'     => $credits ?: $source->credit_hours,
                    'info'             => $info,
                    'cert_template'    => $request->has('certificateTemplate') ? $request->input('certificateTemplate') : $source->cert_template,
                ];
                if ($request->has('institutionId') && AuthService::isSuperAdmin($actor)) {
                    $updateFields['institution_id'] = $targetInstId;
                }

                $source->update($updateFields);
            }

            CacheService::invalidateSources();
            return response()->json(['status' => 'success', 'sourceId' => $sourceId]);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('saveAdminSource exception: ' . $e->getMessage(), [
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json([
                'status' => 'error',
                'message' => 'เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' . $e->getMessage()
            ], 500);
        }
    }

    /** deleteAdminSource */
    public function deleteAdminSource(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor || !in_array($actor['role'], ['admin', 'teacher'])) {
            return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์ลบข้อมูล']);
        }

        $sourceId = trim($request->input('sourceId') ?? '');
        if (!$sourceId) return response()->json(['status' => 'error', 'message' => 'ไม่พบรหัสแหล่งเรียนรู้']);

        $source = Source::find($sourceId);
        if (!$source) return response()->json(['status' => 'error', 'message' => 'ไม่พบแหล่งเรียนรู้']);

        if ($actor['role'] === 'teacher') {
            $teacherClean = AuthService::normalizeTambon($actor['tambon'] ?? '');
            $sourceClean  = AuthService::normalizeTambon($source->tambon ?? '');
            if ($teacherClean !== $sourceClean) {
                return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์ลบแหล่งเรียนรู้นอกพื้นที่']);
            }
        }

        $source->delete();
        CacheService::invalidateSources();

        return response()->json(['status' => 'success']);
    }

    /** saveAdminBase */
    public function saveAdminBase(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor || !in_array($actor['role'], ['admin', 'teacher'])) {
            return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์จัดการฐานการเรียนรู้']);
        }

        $mode     = strtolower(trim($request->input('mode') ?? 'create'));
        $sourceId = trim($request->input('sourceId') ?? '');
        $baseName = trim($request->input('baseName') ?? '');
        $baseId   = trim($request->input('baseId') ?? '');

        if (!$sourceId) return response()->json(['status' => 'error', 'message' => 'กรุณาระบุรหัสแหล่งเรียนรู้']);
        if (!$baseName) return response()->json(['status' => 'error', 'message' => 'กรุณากรอกชื่อฐานการเรียนรู้']);
        if (!Source::find($sourceId)) return response()->json(['status' => 'error', 'message' => 'ไม่พบแหล่งเรียนรู้สำหรับฐานนี้']);

        $info = [
            'history'  => $request->input('history') ?? '',
            'result'   => $request->input('result') ?? '',
            'contact'  => $request->input('contact') ?? '',
            'gallery'  => $request->input('gallery') ?? '',
            'external' => $request->input('external') ?? '',
            'gps'      => $request->input('gps') ?? '',
        ];

        $existingBase = (!empty($baseId) && $baseId !== '(ระบบสร้างอัตโนมัติ)') ? Base::find($baseId) : null;

        if ($existingBase || $mode === 'edit') {
            if (!$existingBase && $baseId) {
                $existingBase = Base::find($baseId);
            }
            if (!$existingBase) {
                return response()->json(['status' => 'error', 'message' => 'ไม่พบฐานการเรียนรู้ที่ต้องการแก้ไข']);
            }

            $rawBaseCover = $request->input('coverImage') ?? $request->input('cover_image') ?? null;
            $baseCover = $rawBaseCover !== null ? $this->saveBase64ImageFile($rawBaseCover, 'base_cover') : null;

            $existingBase->update([
                'name'          => $baseName,
                'description'   => $request->input('description') ?? $existingBase->description,
                'cover_image'   => $baseCover !== null ? $baseCover : $existingBase->cover_image,
                'video_url'     => $request->input('videoUrl') ?? $existingBase->video_url,
                'display_order' => (int) ($request->input('displayOrder') ?? $existingBase->display_order),
                'is_active'     => $request->input('isActive') !== null ? (bool) $request->input('isActive') : $existingBase->is_active,
                'info'          => $info,
            ]);
            $baseId = $existingBase->id;
        } else {
            if (!$baseId || $baseId === '(ระบบสร้างอัตโนมัติ)' || Base::find($baseId)) {
                $max = Base::selectRaw("MAX(CAST(SUBSTRING(id, 4) AS UNSIGNED)) as max_no")->value('max_no') ?? 0;
                do {
                    $max++;
                    $baseId = 'BAS' . str_pad($max, 4, '0', STR_PAD_LEFT);
                } while (Base::find($baseId));
            }

            $rawBaseCover = $request->input('coverImage') ?? $request->input('cover_image') ?? '';
            $baseCover = $this->saveBase64ImageFile($rawBaseCover, 'base_cover');

            Base::create([
                'id'            => $baseId,
                'source_id'     => $sourceId,
                'name'          => $baseName,
                'description'   => $request->input('description') ?? '',
                'cover_image'   => $baseCover,
                'video_url'     => $request->input('videoUrl') ?? '',
                'display_order' => (int) ($request->input('displayOrder') ?? 999),
                'is_active'     => true,
                'info'          => $info,
            ]);
        }

        CacheService::invalidateSources();
        return response()->json(['status' => 'success', 'baseId' => $baseId]);
    }

    /** deleteAdminBase */
    public function deleteAdminBase(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor || !in_array($actor['role'], ['admin', 'teacher'])) {
            return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์ลบฐานการเรียนรู้']);
        }

        $baseId = trim($request->input('baseId') ?? '');
        if (!$baseId) return response()->json(['status' => 'error', 'message' => 'ไม่พบรหัสฐานการเรียนรู้']);

        Base::destroy($baseId);
        CacheService::invalidateSources();

        return response()->json(['status' => 'success']);
    }

    /** saveAdminBaseOrder */
    public function saveAdminBaseOrder(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor || !in_array($actor['role'], ['admin', 'teacher'])) {
            return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์จัดลำดับฐานการเรียนรู้']);
        }

        $sourceId = trim($request->input('sourceId') ?? '');
        $baseIds  = (array) ($request->input('baseIds') ?? []);

        if (!$sourceId) return response()->json(['status' => 'error', 'message' => 'ไม่พบรหัสแหล่งเรียนรู้']);
        if (empty($baseIds)) return response()->json(['status' => 'error', 'message' => 'ไม่พบรายการฐานสำหรับจัดลำดับ']);

        foreach ($baseIds as $idx => $bid) {
            Base::where('id', $bid)->where('source_id', $sourceId)->update(['display_order' => $idx + 1]);
        }

        CacheService::invalidateSources();
        return response()->json(['status' => 'success']);
    }

    /** saveSourceEvaluation — บันทึกผลการประเมินมาตรฐานแหล่งเรียนรู้ตาม พ.ร.บ. สกร. มาตรา 6 */
    public function saveSourceEvaluation(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor || !in_array($actor['role'], ['admin', 'teacher'])) {
            return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์ประเมินมาตรฐานแหล่งเรียนรู้']);
        }

        $sourceId = trim($request->input('sourceId') ?? '');
        if (!$sourceId) {
            return response()->json(['status' => 'error', 'message' => 'ไม่พบรหัสแหล่งเรียนรู้']);
        }

        $source = Source::find($sourceId);
        if (!$source) {
            return response()->json(['status' => 'error', 'message' => 'ไม่พบข้อมูลแหล่งเรียนรู้']);
        }

        $rawEval = $request->input('evaluation');
        if (is_string($rawEval)) {
            $rawEval = json_decode($rawEval, true);
        }
        if (!is_array($rawEval)) {
            $rawEval = $request->all();
        }

        $totalScore = (float) ($rawEval['totalScore'] ?? $rawEval['total_score'] ?? $request->input('total_score') ?? $request->input('totalScore') ?? 0);
        $avgScore   = (float) ($rawEval['avgScore'] ?? $rawEval['average_score'] ?? $request->input('average_score') ?? $request->input('avgScore') ?? 0);
        if ($avgScore <= 0 && $totalScore > 0) {
            $avgScore = $totalScore / 6;
        }

        $info = $source->info ?? [];
        $info['evaluation'] = [
            'evaluator'     => trim($rawEval['evaluatorName'] ?? $rawEval['evaluator'] ?? $request->input('evaluator') ?? $request->input('evaluatorName') ?? ''),
            'evaluatorName' => trim($rawEval['evaluatorName'] ?? $rawEval['evaluator'] ?? $request->input('evaluator') ?? $request->input('evaluatorName') ?? ''),
            'evaluated_at'  => trim($rawEval['evaluatedDate'] ?? $rawEval['evaluated_at'] ?? $request->input('evaluated_at') ?? $request->input('evaluatedDate') ?? date('Y-m-d')),
            'evaluatedDate' => trim($rawEval['evaluatedDate'] ?? $rawEval['evaluated_at'] ?? $request->input('evaluated_at') ?? $request->input('evaluatedDate') ?? date('Y-m-d')),
            'strengths'     => trim($rawEval['strengths'] ?? $request->input('strengths') ?? ''),
            'comments'      => trim($rawEval['comments'] ?? $request->input('comments') ?? ''),
            'ratings'       => $rawEval['ratings'] ?? $request->input('ratings') ?? [],
            'evidence'      => $rawEval['evidence'] ?? $request->input('evidence') ?? [],
            'scores'        => $rawEval['scores'] ?? $request->input('scores') ?? [],
            'checklist'     => $rawEval['checklist'] ?? $request->input('checklist') ?? [],
            'total_score'   => $totalScore,
            'totalScore'    => $totalScore,
            'average_score' => $avgScore,
            'avgScore'      => $avgScore,
            'grade'         => trim($rawEval['grade'] ?? $request->input('grade') ?? ''),
        ];

        $source->update(['info' => $info]);

        CacheService::invalidateSources();

        return response()->json(['status' => 'success', 'data' => $info['evaluation']]);
    }

    /** generateSourceStandardCert — ออกใบประกาศรับรองมาตรฐานแหล่งเรียนรู้ สกร. (PDF) */
    /** generateSourceStandardCert — ออกใบประกาศรับรองมาตรฐานแหล่งเรียนรู้ สกร. (PDF) หรือแบบรายงาน ม.6 */
    public function generateSourceStandardCert(Request $request)
    {
        $actor = AuthService::buildActorFromRequest($request);

        $sourceId = trim($request->input('sourceId') ?? $request->query('sourceId') ?? '');
        if (!$sourceId) {
            return response()->json(['status' => 'error', 'message' => 'ไม่พบรหัสแหล่งเรียนรู้'], 400);
        }

        $source = Source::find($sourceId);
        if (!$source) {
            return response()->json(['status' => 'error', 'message' => 'ไม่พบข้อมูลแหล่งเรียนรู้'], 404);
        }

        $format = strtolower(trim($request->input('format') ?? $request->query('format') ?? ''));
        $info = $source->info ?? [];
        $evaluation = $info['evaluation'] ?? [];

        // คำนวณคะแนนและระดับ
        $totalScore = (float)($evaluation['total_score'] ?? $evaluation['totalScore'] ?? 0);
        $avgScore = (float)($evaluation['average_score'] ?? $evaluation['avgScore'] ?? 0);
        if ($avgScore <= 0 && $totalScore > 0) {
            $avgScore = $totalScore / 6;
        } elseif ($avgScore <= 0 && $totalScore <= 0) {
            // Default preview score
            $avgScore = 4.50;
            $totalScore = 27.0;
        }

        $grade = $evaluation['grade'] ?? '';
        if (empty($grade)) {
            if ($totalScore >= 27) $grade = 'ดีเด่น (5 ดาว)';
            elseif ($totalScore >= 24) $grade = 'ดีมาก (4 ดาว)';
            elseif ($totalScore >= 21) $grade = 'ดี (3 ดาว)';
            else $grade = 'ผ่านเกณฑ์มาตรฐาน';
        }

        $evaluator = $evaluation['evaluatorName'] ?? $evaluation['evaluator'] ?? ($actor['name'] ?? 'คณะกรรมการประเมินมาตรฐาน สกร.');
        $evaluatedAt = $evaluation['evaluatedDate'] ?? $evaluation['evaluated_at'] ?? date('Y-m-d');

        $dateParts = explode('-', $evaluatedAt);
        $thaiYear = count($dateParts) === 3 ? ((int)$dateParts[0] > 2500 ? (int)$dateParts[0] : (int)$dateParts[0] + 543) : (date('Y') + 543);
        $thaiMonths = ['', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
        $thaiMonth = count($dateParts) === 3 ? ($thaiMonths[(int)$dateParts[1]] ?? '') : '';
        $thaiDay = count($dateParts) === 3 ? (int)$dateParts[2] : date('d');
        $formattedThaiDate = "{$thaiDay} {$thaiMonth} พ.ศ. {$thaiYear}";

        $certNo = 'SRC-STD-' . strtoupper(substr(md5($source->id . $evaluatedAt), 0, 8));

        $sourceTypeLabel = match($info['source_type'] ?? 'place') {
            'person' => 'แหล่งเรียนรู้ประเภทบุคคล',
            'media'  => 'แหล่งเรียนรู้ประเภทสื่อ นวัตกรรม เทคโนโลยี และสิ่งประดิษฐ์',
            default  => 'แหล่งเรียนรู้ประเภทสถานที่',
        };

        $instId = $source->institution_id ?? 'INS_PHRAO';
        if ($instId === 'ALL' || !$instId) $instId = 'INS_PHRAO';

        $globalSettings = Setting::get("settings_{$instId}", []);
        if (empty($globalSettings) || !is_array($globalSettings)) {
            $globalSettings = Setting::get('global_settings', []);
        }

        $sigUrl = $globalSettings['signatureUrl'] ?? '';
        $directorName = $globalSettings['directorName'] ?? '';
        $defaultDirectorTitle = ($instId === 'INS_MAERIM')
            ? 'ผู้อำนวยการศูนย์ส่งเสริมการเรียนรู้ระดับอำเภอแม่ริม'
            : 'ผู้อำนวยการศูนย์ส่งเสริมการเรียนรู้ระดับอำเภอพร้าว';
        $directorTitle = $globalSettings['directorTitle'] ?? $defaultDirectorTitle;

        $signerName = !empty($directorName) ? $directorName : (!empty($evaluator) && !str_contains($evaluator, 'คณะกรรมการ') ? $evaluator : 'ผู้บริหารสถานศึกษา');
        $signerTitle = !empty($directorTitle) ? $directorTitle : $defaultDirectorTitle;

        // ─── FORMAT: REPORT (แบบรายงานผลการประเมิน ม.6) ─────────────
        if ($format === 'report') {
            $ratings = $evaluation['ratings'] ?? [];
            $strengths = $evaluation['strengths'] ?? 'มีความพร้อมด้านสถานที่ บุคลากร และองค์ความรู้ที่สามารถถ่ายทอดสู่ผู้เรียนและชุมชนได้อย่างมีประสิทธิภาพ';
            $comments = $evaluation['comments'] ?? 'ควรส่งเสริมการใช้สื่อนวัตกรรมดิจิทัลและการประชาสัมพันธ์เชิงรุกอย่างต่อเนื่อง';

            $reportHtml = '<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <title>แบบรายงานผลการประเมินมาตรฐานแหล่งเรียนรู้ — ' . e($source->name) . '</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;600;700;800&family=Prompt:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    body { font-family: "Sarabun", sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 20px; font-size: 14px; line-height: 1.6; }
    .page { max-width: 820px; margin: 0 auto; background: #fff; padding: 40px 50px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
    .header { text-align: center; margin-bottom: 25px; border-bottom: 2px solid #0284c7; padding-bottom: 15px; }
    .title { font-size: 18px; font-weight: bold; margin: 0; color: #0369a1; }
    .subtitle { font-size: 14px; color: #475569; margin-top: 4px; }
    .meta-box { background: #f1f5f9; padding: 15px 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #0284c7; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 20px; font-size: 13px; }
    .meta-item b { color: #334155; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
    th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; }
    th { background: #f8fafc; font-weight: bold; color: #1e293b; text-align: center; }
    .text-center { text-align: center; }
    .summary-card { background: #ecfdf5; border: 1px solid #a7f3d0; padding: 15px; border-radius: 8px; text-align: center; margin-bottom: 20px; }
    .summary-card h3 { margin: 0 0 5px 0; color: #047857; font-size: 16px; }
    .btn-bar { display: flex; justify-content: flex-end; gap: 10px; margin-bottom: 15px; max-width: 820px; margin-left: auto; margin-right: auto; }
    .btn { padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer; border: none; font-size: 13px; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; }
    .btn-print { background: #0284c7; color: #fff; }
    .btn-back { background: #e2e8f0; color: #334155; }
    @media print {
      body { background: #fff; padding: 0; }
      .page { box-shadow: none; padding: 20px; max-width: 100%; }
      .btn-bar { display: none; }
    }
  </style>
</head>
<body>
  <div class="btn-bar">
    <a href="javascript:history.back()" class="btn btn-back">← ย้อนกลับ</a>
    <button onclick="window.print()" class="btn btn-print">🖨️ พิมพ์แบบรายงาน (Print)</button>
  </div>
  <div class="page">
    <div class="header">
      <h1 class="title">แบบรายงานผลการประเมินมาตรฐานแหล่งเรียนรู้</h1>
      <div class="subtitle">ตามพระราชบัญญัติส่งเสริมการเรียนรู้ พ.ศ. ๒๕๖๖ (มาตรา ๖)</div>
      <div style="font-size: 12px; color: #64748b; margin-top: 4px;">เลขที่อ้างอิง: ' . e($certNo) . '</div>
    </div>

    <div class="meta-box">
      <div class="meta-grid">
        <div class="meta-item"><b>ชื่อแหล่งเรียนรู้:</b> ' . e($source->name) . '</div>
        <div class="meta-item"><b>ประเภท:</b> ' . e($sourceTypeLabel) . '</div>
        <div class="meta-item"><b>ตำบล/พื้นที่:</b> ' . e($source->tambon) . '</div>
        <div class="meta-item"><b>สถานศึกษาหลัก:</b> ' . e($signerTitle) . '</div>
        <div class="meta-item"><b>วันที่ประเมิน:</b> ' . e($formattedThaiDate) . '</div>
        <div class="meta-item"><b>ผู้ตรวจประเมิน:</b> ' . e($evaluator) . '</div>
      </div>
    </div>

    <div class="summary-card">
      <h3>สรุปผลการประเมิน: ' . e($grade) . '</h3>
      <div>คะแนนรวม: <b>' . number_format($totalScore, 2) . ' / 30.00</b> | คะแนนเฉลี่ย: <b>' . number_format($avgScore, 2) . ' / 5.00</b> (สถานะ: ผ่านเกณฑ์มาตรฐาน สกร.)</div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 45px;">ลำดับ</th>
          <th>มาตรฐานและตัวชี้วัด ๖ ด้าน (Section 6 NFE Act)</th>
          <th style="width: 90px;">คะแนนเต็ม</th>
          <th style="width: 90px;">คะแนนที่ได้</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="text-center">๑</td>
          <td>ด้านกายภาพ สิ่งแวดล้อม และความปลอดภัยของสถานที่</td>
          <td class="text-center">๕.๐๐</td>
          <td class="text-center"><b>' . number_format((float)($ratings['1.1'] ?? 4.8), 2) . '</b></td>
        </tr>
        <tr>
          <td class="text-center">๒</td>
          <td>ด้านการบริหารจัดการและแผนงานดำเนินงาน</td>
          <td class="text-center">๕.๐๐</td>
          <td class="text-center"><b>' . number_format((float)($ratings['2.1'] ?? 4.5), 2) . '</b></td>
        </tr>
        <tr>
          <td class="text-center">๓</td>
          <td>ด้านวิทยากร ปราชญ์ชุมชน และการถ่ายทอดองค์ความรู้</td>
          <td class="text-center">๕.๐๐</td>
          <td class="text-center"><b>' . number_format((float)($ratings['3.1'] ?? 4.7), 2) . '</b></td>
        </tr>
        <tr>
          <td class="text-center">๔</td>
          <td>ด้านหลักสูตร เนื้อหา และสื่อนวัตกรรมการเรียนรู้</td>
          <td class="text-center">๕.๐๐</td>
          <td class="text-center"><b>' . number_format((float)($ratings['4.1'] ?? 4.4), 2) . '</b></td>
        </tr>
        <tr>
          <td class="text-center">๕</td>
          <td>ด้านการมีส่วนร่วมของชุมชนและการบริการสาธารณะ</td>
          <td class="text-center">๕.๐๐</td>
          <td class="text-center"><b>' . number_format((float)($ratings['5.1'] ?? 4.6), 2) . '</b></td>
        </tr>
        <tr>
          <td class="text-center">๖</td>
          <td>ด้านการประเมินผลและการพัฒนาคุณภาพอย่างต่อเนื่อง</td>
          <td class="text-center">๕.๐๐</td>
          <td class="text-center"><b>' . number_format((float)($ratings['6.1'] ?? 4.5), 2) . '</b></td>
        </tr>
        <tr style="background: #f1f5f9; font-weight: bold;">
          <td colspan="2" style="text-align: right; padding-right: 15px;">รวมคะแนนประเมินทั้ง ๖ ด้าน:</td>
          <td class="text-center">๓๐.๐๐</td>
          <td class="text-center" style="color: #0369a1; font-size: 15px;">' . number_format($totalScore, 2) . '</td>
        </tr>
      </tbody>
    </table>

    <div style="margin-bottom: 15px;">
      <b style="color: #047857;">จุดเด่นของแหล่งเรียนรู้:</b>
      <p style="margin: 4px 0 12px 0; color: #334155;">' . e($strengths) . '</p>
      
      <b style="color: #0369a1;">ข้อเสนอแนะในการพัฒนาคุณภาพ:</b>
      <p style="margin: 4px 0 15px 0; color: #334155;">' . e($comments) . '</p>
    </div>

    <div style="margin-top: 40px; display: flex; justify-content: flex-end;">
      <div style="text-align: center; width: 250px;">
        ' . (!empty($sigUrl) ? '<img src="' . $sigUrl . '" style="max-height: 45px; margin-bottom: 5px;">' : '<div style="height: 45px;"></div>') . '
        <div>( ' . e($signerName) . ' )</div>
        <div style="font-size: 12px; color: #475569;">' . e($signerTitle) . '</div>
        <div style="font-size: 12px; color: #64748b; margin-top: 2px;">ผู้รับรองผลการประเมิน</div>
      </div>
    </div>
  </div>
</body>
</html>';
            return response($reportHtml, 200)->header('Content-Type', 'text/html; charset=UTF-8');
        }

        // ─── CERTIFICATE HTML GENERATION ────────────────────────────
        $fontPath = str_replace('\\', '/', public_path('fonts/THSarabun.ttf'));
        $fontBoldPath = str_replace('\\', '/', public_path('fonts/THSarabunNew-Bold.ttf'));
        $fontCss = '@font-face { font-family: \'THSarabun\'; src: url("file:///' . $fontPath . '") format("truetype"); font-weight: normal; font-style: normal; } '
                 . '@font-face { font-family: \'THSarabun\'; src: url("file:///' . $fontBoldPath . '") format("truetype"); font-weight: bold; font-style: normal; } '
                 . '@font-face { font-family: \'THSarabunNew\'; src: url("file:///' . $fontPath . '") format("truetype"); font-weight: normal; font-style: normal; } '
                 . '@font-face { font-family: \'THSarabunNew\'; src: url("file:///' . $fontBoldPath . '") format("truetype"); font-weight: bold; font-style: normal; } ';

        // Default Certificate Layout
        $outerW = 801;
        $outerH = 555;
        $avgScoreFormatted = number_format($avgScore, 2);

        $html = '<!doctype html><html lang="th"><head><meta charset="utf-8"><style>'
            . $fontCss
            . '@page { size: 297mm 210mm; margin: 0; } '
            . 'html, body { margin: 0; padding: 0; width: 841.89pt; height: 595.28pt; background: #ffffff; font-family: "THSarabun", "THSarabunNew", "Sarabun", sans-serif; overflow: hidden; text-align: center; } '
            . '.cert-outer { position: absolute; top: 18pt; left: 18pt; width: ' . $outerW . 'pt; height: ' . $outerH . 'pt; border: 3.5pt solid #0369a1; background: transparent; box-sizing: border-box; } '
            . '.cert-inner { position: absolute; top: 22pt; left: 22pt; width: 797pt; height: 551pt; padding: 20pt 25pt 15pt 25pt; text-align: center; background: transparent; box-sizing: border-box; border: none; } '
            . '.cert-header { font-size: 31pt; font-weight: bold; color: #0369a1; margin-top: 10pt; line-height: 1.2; } '
            . '.cert-header-sub { font-size: 19.5pt; font-weight: bold; color: #334155; margin-top: 4pt; line-height: 1.2; } '
            . '.cert-subtitle { font-size: 17.5pt; font-weight: bold; color: #334155; margin-bottom: 6pt; line-height: 1.25; } '
            . '.cert-name { font-size: 35pt; font-weight: bold; color: #0f172a; margin: 8pt 0 4pt 0; line-height: 1.2; text-decoration: none; } '
            . '.cert-type { font-size: 19.5pt; font-weight: bold; color: #0284c7; margin: 6pt 0 10pt 0; } '
            . '.cert-desc { font-size: 16.5pt; font-weight: bold; color: #1e293b; margin: 6pt 0 10pt 0; line-height: 1.3; } '
            . '.cert-badge { background: #ecfdf5; border: 1.5pt solid #059669; color: #047857; border-radius: 20pt; display: inline-block; padding: 4pt 24pt; margin: 6pt 0 10pt 0; font-size: 17.5pt; font-weight: bold; } '
            . '.cert-date { font-size: 17.5pt; font-weight: bold; color: #1e293b; margin-top: 6pt; margin-bottom: 10pt; } '
            . '.cert-sig-block { margin: 8pt auto 0 auto; text-align: center; width: 450pt; } '
            . '.cert-signer-name { font-size: 13.5pt; font-weight: bold; color: #0f172a; line-height: 1.2; } '
            . '.cert-signer-title { font-size: 12pt; font-weight: bold; color: #334155; margin-top: 2pt; line-height: 1.2; } '
            . '.cert-ref-block { position: absolute; left: 20pt; bottom: 40pt; font-size: 10.5pt; color: #64748b; text-align: left; } '
            . '</style></head><body>'
            . '<div class="cert-outer"></div>'
            . '<div class="cert-inner">'
            . '<div class="cert-header">ใบประกาศรับรองมาตรฐานแหล่งเรียนรู้</div>'
            . '<div class="cert-header-sub">กรมส่งเสริมการเรียนรู้ กระทรวงศึกษาธิการ</div>'
            . '<div class="cert-subtitle">ขอมอบใบประกาศรับรองมาตรฐานฉบับนี้ไว้เพื่อแสดงว่า</div>'
            . '<div class="cert-name">' . e($source->name) . '</div>'
            . '<div class="cert-type">' . e($sourceTypeLabel) . ' (ตำบล' . e($source->tambon) . ')</div>'
            . '<div class="cert-desc">ได้ผ่านการประเมินตามเกณฑ์มาตรฐานแหล่งเรียนรู้ สกร. (พ.ร.บ. ส่งเสริมการเรียนรู้ พ.ศ. 2566)</div>'
            . '<div class="cert-badge">ผลการประเมินระดับ: ' . e($grade) . ' (คะแนนเฉลี่ย ' . e($avgScoreFormatted) . ' / 5.00)</div>'
            . '<div class="cert-date">ให้ไว้ ณ วันที่ ' . e($formattedThaiDate) . '</div>'
            . '<div class="cert-sig-block">'
            . (!empty($sigUrl) ? '<img src="' . $sigUrl . '" style="max-height: 50pt; width: auto; display: block; margin: 0 auto 3pt auto;">' : '')
            . '<div class="cert-signer-name">(' . e($signerName) . ')</div>'
            . '<div class="cert-signer-title">' . e($signerTitle) . '</div>'
            . '</div>'
            . '<div class="cert-ref-block">เลขที่อ้างอิง: ' . e($certNo) . '</div>'
            . '</div></body></html>';

        $html = $this->liftThaiToneMarks($html);

        if ($format === 'html') {
            return response($html, 200)->header('Content-Type', 'text/html; charset=UTF-8');
        }

        try {
            $pdf = Pdf::loadHTML($html)->setPaper('a4', 'landscape');
            $pdfOutput = $pdf->output();

            if ($format === 'json') {
                $pdfBase64 = base64_encode($pdfOutput);
                return response()->json([
                    'status'     => 'success',
                    'pdf_base64' => 'data:application/pdf;base64,' . $pdfBase64,
                    'filename'   => "ใบประกาศมาตรฐาน_{$source->name}.pdf",
                    'cert_no'    => $certNo,
                ]);
            }

            // Default: Stream PDF directly to browser
            return response($pdfOutput, 200)
                ->header('Content-Type', 'application/pdf')
                ->header('Content-Disposition', 'inline; filename="standard_cert_' . $source->id . '.pdf"');
        } catch (\Throwable $ex) {
            // Fallback: If DomPDF fails, return HTML preview
            return response($html, 200)->header('Content-Type', 'text/html; charset=UTF-8');
        }
    }

    /**
     * ขยับยกตำแหน่งวรรณยุกต์ระดับ 3 (ไม้เอก/ไม้โท/ไม้ตรี/ไม้จัตวา/การันต์) ที่ซ้อนหลังสระบนให้สูงขึ้น 2.5pt
     * ป้องกันการทับซ้อนกันของวรรณยุกต์ระดับ 3 บนสระบนระดับ 2 (เช่น คำว่า "นี้", "ที่", "ผู้" ฯลฯ)
     */
    /**
     * importSourcesCsv — นำเข้าข้อมูลแหล่งเรียนรู้และปราชญ์ชาวบ้านจากไฟล์ CSV/Excel
     */
    public function importSourcesCsv(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor || !in_array($actor['role'], ['admin', 'teacher'])) {
            return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์นำเข้าข้อมูลแหล่งเรียนรู้'], 403);
        }

        $institutionId = trim($request->input('institutionId') ?? $request->input('institution_id') ?? $actor['institution_id'] ?? 'INS_PHRAO');

        $csvText = '';
        if ($request->hasFile('file')) {
            $csvText = file_get_contents($request->file('file')->getRealPath());
        } else if ($request->input('csvContent')) {
            $csvText = $request->input('csvContent');
        }

        if (empty($csvText)) {
            return response()->json(['status' => 'error', 'message' => 'กรุณาอัปโหลดไฟล์ CSV หรือกรอกเนื้อหา CSV']);
        }

        // Clean UTF-8 BOM
        $csvText = preg_replace('/\x{EF}\x{BB}\x{BF}/', '', $csvText);
        $lines = array_filter(explode("\n", str_replace("\r", "", $csvText)));

        if (count($lines) < 2) {
            return response()->json(['status' => 'error', 'message' => 'ไฟล์ CSV ต้องมีอย่างน้อย 1 แถวข้อมูล']);
        }

        $header = str_getcsv(array_shift($lines));
        $headerMap = [];
        foreach ($header as $idx => $colName) {
            $headerMap[trim(mb_strtolower($colName))] = $idx;
        }

        $createdCount = 0;
        $updatedCount = 0;

        foreach ($lines as $lineStr) {
            $row = str_getcsv($lineStr);
            if (count($row) < 2) continue;

            $getVal = function ($keys) use ($row, $headerMap) {
                foreach ((array)$keys as $k) {
                    $keyLower = mb_strtolower($k);
                    if (isset($headerMap[$keyLower]) && isset($row[$headerMap[$keyLower]])) {
                        return trim($row[$headerMap[$keyLower]]);
                    }
                }
                return '';
            };

            $name        = $getVal(['sourcename', 'name', 'ชื่อแหล่งเรียนรู้', 'ชื่อปราชญ์/ฐาน']);
            $tambon      = $getVal(['tambonname', 'tambon', 'ตำบล']);
            $category    = $getVal(['subjectcategory', 'category', 'หมวดวิชา']);
            $hours       = floatval($getVal(['credithours', 'hours', 'ชั่วโมงกพช', 'ชั่วโมง']));
            $sageName    = $getVal(['sagename', 'sage', 'ปราชญ์ชาวบ้าน', 'ผู้ดูแล']);
            $sagePhone   = $getVal(['sagephone', 'phone', 'เบอร์โทร']);
            $lat         = $getVal(['latitude', 'lat']);
            $lng         = $getVal(['longitude', 'lng']);
            $desc        = $getVal(['description', 'history', 'รายละเอียด']);

            if (empty($name)) continue;

            $sourceId = 'SRC' . strtoupper(substr(md5($institutionId . '_' . $name), 0, 8));

            $actorTambon = $actor['tambon'] ?? 'ไม่ระบุ';
            $cleanTambon = $tambon ? AuthService::normalizeTambon($tambon) : $actorTambon;

            $existing = Source::find($sourceId);
            if ($existing) {
                $existing->update([
                    'institution_id'   => $institutionId,
                    'name'             => $name,
                    'tambon'           => $cleanTambon,
                    'subject_category' => $category ?: 'ภูมิปัญญาท้องถิ่น',
                    'credit_hours'     => $hours ?: 20.0,
                    'latitude'         => $lat ?: $existing->latitude,
                    'longitude'        => $lng ?: $existing->longitude,
                    'description'      => $desc ?: $existing->description,
                ]);
                $updatedCount++;
            } else {
                Source::create([
                    'id'               => $sourceId,
                    'institution_id'   => $institutionId,
                    'name'             => $name,
                    'tambon'           => $cleanTambon,
                    'subject_category' => $category ?: 'ภูมิปัญญาท้องถิ่น',
                    'credit_hours'     => $hours ?: 20.0,
                    'latitude'         => $lat ?: '19.3667',
                    'longitude'        => $lng ?: '99.2000',
                    'description'      => $desc ?: 'แหล่งเรียนรู้และภูมิปัญญาท้องถิ่นประจำตำบล',
                    'info'             => [
                        'history'          => $desc,
                        'sage_name'        => $sageName,
                        'sage_phone'       => $sagePhone,
                        'learning_content' => 'การเรียนรู้และฝึกปฏิบัติจริงกับปราชญ์ชาวบ้านประจำชุมชน',
                    ],
                ]);
                $createdCount++;
            }
        }

        CacheService::forgetSourcesList();

        return response()->json([
            'status'  => 'success',
            'message' => "นำเข้าข้อมูลแหล่งเรียนรู้สำเร็จ: เพิ่มใหม่ {$createdCount} รายการ, อัปเดต {$updatedCount} รายการ",
            'created' => $createdCount,
            'updated' => $updatedCount,
        ]);
    }

    private function liftThaiToneMarks(?string $text): string
    {
        if (empty($text)) return '';

        $upperVowels = 'ัิีึื็';
        return preg_replace_callback('/([' . $upperVowels . '])([\x{0E48}-\x{0E4C}])/u', function ($matches) {
            return $matches[1] . '<span style="position: relative; top: -5.5pt;">' . $matches[2] . '</span>';
        }, $text);
    }
}
