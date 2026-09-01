<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\UpskillCategory;
use App\Models\UpskillLearningLog;
use App\Models\UpskillProgress;
use App\Models\UpskillVideo;
use App\Models\User;
use App\Models\PointsTransaction;
use App\Services\AuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class UpskillController extends Controller
{
    public function listVideos(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        $username = $actor ? $actor['username'] : null;

        $userProgress = $username ? UpskillProgress::where('username', $username)->get()->keyBy('video_id') : collect();
        $userLogs = $username ? UpskillLearningLog::where('username', $username)->get()->keyBy('video_id') : collect();

        // Pre-load category names keyed by ID
        $categoryNames = UpskillCategory::all()->keyBy('id')->map(fn($c) => $c->name);

        $query = UpskillVideo::where('is_active', true);
        if ($request->filled('categoryId')) {
            $query->where('category_id', $request->input('categoryId'));
        }

        $videos = $query->orderBy('display_order')->get()->map(function (UpskillVideo $video) use ($userProgress, $userLogs, $categoryNames) {
            $prog = $userProgress->get($video->id);
            $log = $userLogs->get($video->id);

            $durSec = (int) ($video->duration_seconds ?: 300);
            $durMin = round($durSec / 60, 1);
            $durLabel = ($durSec >= 60)
                ? (floor($durSec / 60) . ':' . str_pad($durSec % 60, 2, '0', STR_PAD_LEFT) . ' นาที')
                : ($durSec . ' วินาที');

            return [
                'id'              => (string) $video->id,
                'title'           => $video->title,
                'description'     => $video->description ?? '',
                'url'             => $video->video_url,
                'thumbnail'       => $video->thumbnail_url ?? '',
                'category'        => $categoryNames->get($video->category_id, 'ทักษะอาชีพ'),
                'category_id'     => $video->category_id,
                'duration'        => $durLabel,
                'durationSeconds' => $durSec,
                'order'           => $video->display_order,
                'completed'       => $prog ? (bool) $prog->completed : false,
                'progressSeconds' => $prog ? (int) $prog->progress_seconds : 0,
                'logStatus'       => $log ? $log->status : null,
                'grade'           => $log && $log->grade !== null ? (int) $log->grade : null,
                'feedback'        => $log ? ($log->feedback ?? '') : '',
                'userNotes'       => $log ? ($log->content ?? '') : '',
            ];
        });

        return response()->json(['status' => 'success', 'videos' => $videos, 'data' => $videos]);
    }

    public function saveVideo(Request $request): JsonResponse
    {
        if (!$this->isAdmin($request)) {
            return $this->forbidden();
        }

        $id = $request->input('id') ?? $request->input('videoId');
        $categoryId = $request->input('category') ?? $request->input('categoryId');
        if (!UpskillCategory::whereKey($categoryId)->exists()) {
            return response()->json(['status' => 'error', 'message' => 'ไม่พบหมวดหมู่']);
        }

        $data = [
            'category_id'   => $categoryId,
            'title'         => trim((string) $request->input('title', '')),
            'description'   => (string) $request->input('description', ''),
            'video_url'     => (string) ($request->input('url') ?? $request->input('videoUrl') ?? ''),
            'thumbnail_url' => (string) ($request->input('thumbnail') ?? $request->input('thumbnailUrl') ?? ''),
            'display_order' => (int) ($request->input('order') ?? $request->input('displayOrder') ?? 999),
            'is_active'     => $request->input('isActive') !== false,
        ];

        if ($data['title'] === '' || $data['video_url'] === '') {
            return response()->json(['status' => 'error', 'message' => 'กรุณาระบุชื่อและลิงก์วิดีโอ']);
        }

        $video = $id ? UpskillVideo::find($id) : null;
        if ($id && !$video) {
            return response()->json(['status' => 'error', 'message' => 'ไม่พบวิดีโอ']);
        }
        $video ? $video->update($data) : $video = UpskillVideo::create($data);

        return response()->json(['status' => 'success', 'videoId' => (string) $video->id]);
    }

    public function deleteVideo(Request $request): JsonResponse
    {
        if (!$this->isAdmin($request)) {
            return $this->forbidden();
        }
        UpskillVideo::destroy($request->input('id') ?? $request->input('videoId'));
        return response()->json(['status' => 'success']);
    }

    /**
     * Update video duration_seconds from real YouTube data (called by frontend onReady).
     * Only updates if current value is 0 (i.e. never set). Any authenticated user can trigger this.
     */
    public function updateVideoDuration(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor) {
            return $this->unauthenticated();
        }
        $videoId  = $request->input('videoId');
        $duration = (int) ($request->input('durationSeconds') ?? 0);
        if (!$videoId || $duration <= 0) {
            return response()->json(['status' => 'error', 'message' => 'ข้อมูลไม่ถูกต้อง']);
        }
        // Only update if not already set (duration_seconds = 0)
        $updated = UpskillVideo::where('id', $videoId)
            ->where(function ($q) { $q->whereNull('duration_seconds')->orWhere('duration_seconds', 0); })
            ->update(['duration_seconds' => $duration]);
        return response()->json(['status' => 'success', 'updated' => $updated > 0, 'durationSeconds' => $duration]);
    }


    public function saveProgress(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor) {
            return $this->unauthenticated();
        }

        $videoId = $request->input('videoId');
        // Accept progressSeconds (absolute YouTube position) or seconds (legacy)
        $progressSec = max(0, min(86400, (int) ($request->input('progressSeconds') ?? $request->input('seconds') ?? 0)));
        $watchedSec  = max(0, min(86400, (int) ($request->input('watchedSeconds') ?? $progressSec)));

        $video = UpskillVideo::find($videoId);
        if (!$video) {
            return response()->json(['status' => 'error', 'message' => 'ไม่พบวิดีโอ']);
        }

        $progress = DB::transaction(function () use ($actor, $video, $progressSec, $watchedSec) {
            $progress = UpskillProgress::where('username', $actor['username'])
                ->where('video_id', $video->id)
                ->lockForUpdate()
                ->first();
            if (!$progress) {
                $progress = new UpskillProgress([
                    'username'         => $actor['username'],
                    'video_id'         => $video->id,
                    'progress_seconds' => 0,
                    'watched_seconds'  => 0,
                ]);
            }
            // Use MAX so we never go backwards (e.g. if user seeks back)
            $progress->progress_seconds = max((int) $progress->progress_seconds, $progressSec);
            // Accumulate real watched seconds (not position)
            if (isset($progress->watched_seconds)) {
                $progress->watched_seconds = max((int) $progress->watched_seconds, $watchedSec);
            }
            $progress->save();
            return $progress;
        });

        return response()->json([
            'status'          => 'success',
            'progressSeconds' => $progress->progress_seconds,
        ]);
    }

    public function getProgress(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor) {
            return $this->unauthenticated();
        }

        $rows = UpskillProgress::query()
            ->join('upskill_videos', 'upskill_videos.id', '=', 'upskill_progress.video_id')
            ->where('upskill_progress.username', $actor['username'])
            ->selectRaw('upskill_videos.category_id, SUM(upskill_progress.progress_seconds) AS total_seconds')
            ->groupBy('upskill_videos.category_id')
            ->get();
        $progress = $rows->mapWithKeys(fn ($row) => [(string) $row->category_id => (int) $row->total_seconds]);

        return response()->json(['status' => 'success', 'progress' => $progress]);
    }

    public function listCategories(Request $request): JsonResponse
    {
        $categories = UpskillCategory::where('is_active', true)->orderBy('display_order')->get()->map(fn (UpskillCategory $category) => [
            'id'    => (string) $category->id,
            'label' => $category->name,
            'icon'  => $category->icon ?: 'fa-video',
            'color' => $category->color ?: '#10b981',
            'order' => $category->display_order,
        ]);
        return response()->json(['status' => 'success', 'categories' => $categories, 'data' => $categories]);
    }

    public function saveCategory(Request $request): JsonResponse
    {
        if (!$this->isAdmin($request)) {
            return $this->forbidden();
        }

        $id = $request->input('id') ?? $request->input('categoryId');
        $data = [
            'name'          => trim((string) ($request->input('label') ?? $request->input('name') ?? '')),
            'icon'          => trim((string) $request->input('icon', 'fa-video')),
            'color'         => trim((string) $request->input('color', '#10b981')),
            'description'   => (string) $request->input('description', ''),
            'image_url'     => (string) $request->input('imageUrl', ''),
            'display_order' => (int) ($request->input('order') ?? $request->input('displayOrder') ?? 999),
            'is_active'     => $request->input('isActive') !== false,
        ];
        if ($data['name'] === '') {
            return response()->json(['status' => 'error', 'message' => 'กรุณาระบุชื่อหมวดหมู่']);
        }

        $category = $id ? UpskillCategory::find($id) : null;
        if ($id && !$category) {
            return response()->json(['status' => 'error', 'message' => 'ไม่พบหมวดหมู่']);
        }
        $category ? $category->update($data) : $category = UpskillCategory::create($data);

        return response()->json(['status' => 'success', 'categoryId' => (string) $category->id]);
    }

    public function deleteCategory(Request $request): JsonResponse
    {
        if (!$this->isAdmin($request)) {
            return $this->forbidden();
        }
        UpskillCategory::destroy($request->input('id') ?? $request->input('categoryId'));
        return response()->json(['status' => 'success']);
    }

    public function completeVideo(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor) {
            return $this->unauthenticated();
        }

        $videoId = $request->input('videoId') ?? $request->input('id');
        $video = UpskillVideo::find($videoId);
        if (!$video) {
            return response()->json(['status' => 'error', 'message' => 'ไม่พบวิดีโอ']);
        }

        $user = User::where('username', $actor['username'])->first();
        if (!$user) {
            return response()->json(['status' => 'error', 'message' => 'ไม่พบผู้ใช้']);
        }

        $progress = UpskillProgress::where('username', $actor['username'])
            ->where('video_id', $video->id)
            ->first();

        $alreadyCompleted = $progress && (bool) $progress->completed;

        if (!$progress) {
            $progress = new UpskillProgress([
                'username'         => $actor['username'],
                'video_id'         => $video->id,
                'progress_seconds' => (int) ($video->duration_seconds ?: 60),
                'completed'        => true,
            ]);
            $progress->save();
        } else if (!$alreadyCompleted) {
            $progress->completed = true;
            $progress->save();
        }

        $pointsAwarded = 0;
        if (!$alreadyCompleted) {
            // Use real duration from frontend (YouTube getDuration) if provided, else fallback to DB
            $realSec = (int) ($request->input('realDurationSeconds') ?? $request->input('durationSeconds') ?? $video->duration_seconds ?? 0);
            if ($realSec <= 0) $realSec = (int) ($video->duration_seconds ?: 60);
            // 1 point per minute, minimum 1
            $pointsAwarded = max(1, (int) floor($realSec / 60));

            $newScore = (int) $user->score + $pointsAwarded;
            $user->update([
                'score' => $newScore,
                'level' => AuthService::levelFromScore($newScore),
            ]);

            PointsTransaction::create([
                'username'    => $user->username,
                'type'        => 'upskill_watch',
                'points'      => $pointsAwarded,
                'description' => "ดูวิดีโอการเรียนรู้จบ: {$video->title} (+{$pointsAwarded} แต้ม)",
            ]);
        }

        return response()->json([
            'status'        => 'success',
            'completed'     => true,
            'pointsAwarded' => $pointsAwarded,
            'message'       => $pointsAwarded > 0
                ? "🎉 ยินดีด้วย! ดูวิดีโอจบแล้ว ได้รับ {$pointsAwarded} แต้มสะสม!"
                : "คุณเคยรับแต้มจากการดูคลิปนี้แล้ว",
            'newScore'      => (int) $user->score,
        ]);
    }

    public function saveLearningLog(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor) {
            return $this->unauthenticated();
        }

        $video = UpskillVideo::find($request->input('videoId'));
        $notes = trim((string) ($request->input('notes') ?? $request->input('content') ?? $request->input('text') ?? ''));
        if (!$video || $notes === '') {
            return response()->json(['status' => 'error', 'message' => 'กรุณากรอกข้อความสรุปองค์ความรู้']);
        }

        $log = UpskillLearningLog::updateOrCreate(
            ['username' => $actor['username'], 'video_id' => $video->id],
            [
                'video_title' => $video->title,
                'category_id' => $video->category_id,
                'content'     => $notes,
                'status'      => 'Pending',
            ]
        );

        return response()->json([
            'status'        => 'success',
            'message'       => 'ส่งบันทึกสรุปความรู้เรียบร้อยแล้ว รอครูตรวจประเมิน (คะแนนสูงสุด 10 แต้ม)',
            'log'           => $this->learningLogArray($log),
        ]);
    }

    public function getLearningLog(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor) {
            return $this->unauthenticated();
        }
        $log = UpskillLearningLog::where('username', $actor['username'])
            ->where('video_id', $request->input('videoId'))
            ->latest('updated_at')
            ->first();
        return response()->json(['status' => 'success', 'log' => $log ? $this->learningLogArray($log) : null]);
    }

    public function listLearningLogs(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor) {
            return $this->unauthenticated();
        }

        $query = UpskillLearningLog::with('user');
        if (!in_array($actor['role'], ['admin', 'teacher'], true)) {
            $query->where('username', $actor['username']);
        } else {
            $instId = trim($request->input('institutionId') ?? $request->input('institution_id') ?? '');
            if (!$instId && $actor['institution_id'] !== 'ALL') {
                $instId = $actor['institution_id'];
            }
            if ($instId && $instId !== 'ALL' && $instId !== 'ทั้งหมด') {
                $query->whereHas('user', fn ($q) => $q->where('institution_id', $instId));
            }
            if ($actor['role'] === 'teacher') {
                $query->whereHas('user', fn ($q) => $q->where('tambon', AuthService::normalizeTambon($actor['tambon'])));
            }
        }

        $filter = strtolower((string) $request->input('statusFilter', 'all'));
        if ($filter === 'pending') {
            $query->where('status', 'Pending');
        } elseif (in_array($filter, ['graded', 'approved'], true)) {
            $query->where('status', 'Approved');
        }

        $logs = $query->orderByDesc('updated_at')->limit(500)->get()->map(fn (UpskillLearningLog $log) => array_merge(
            $this->learningLogArray($log),
            [
                'fullName' => $log->user?->full_name ?? '',
                'tambon'   => $log->user?->tambon ?? '',
            ]
        ));
        return response()->json(['status' => 'success', 'logs' => $logs, 'data' => $logs]);
    }

    public function gradeLearningLog(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor || !in_array($actor['role'], ['admin', 'teacher'], true)) {
            return $this->forbidden();
        }
        $log = UpskillLearningLog::with('user')->find($request->input('logId'));
        if (!$log) {
            return response()->json(['status' => 'error', 'message' => 'ไม่พบบันทึก']);
        }
        if ($actor['institution_id'] !== 'ALL' && $log->user?->institution_id && $log->user->institution_id !== $actor['institution_id']) {
            return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์ตรวจงานต่างสถานศึกษา'], 403);
        }
        if ($actor['role'] === 'teacher' && AuthService::normalizeTambon((string) $log->user?->tambon) !== AuthService::normalizeTambon((string) $actor['tambon'])) {
            return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์ตรวจงานต่างตำบล'], 403);
        }
        $scoreInput = (float) ($request->input('score') ?? $request->input('points') ?? $request->input('grade') ?? 0);
        $status = strtolower((string) $request->input('status')) === 'rejected' ? 'Rejected' : 'Approved';
        $feedback = (string) ($request->input('feedback') ?? $request->input('note') ?? '');

        $awardPoints = max(0, min(10, (int) round($scoreInput)));
        $oldStatus = $log->status;
        $oldGrade = $oldStatus === 'Approved' ? (int) ($log->grade ?? 0) : 0;

        $log->update([
            'status'    => $status,
            'grade'     => $status === 'Approved' ? $awardPoints : 0,
            'feedback'  => $feedback,
            'graded_at' => now(),
            'graded_by' => $actor['username'],
        ]);

        $user = User::where('username', $log->username)->first();
        if ($user) {
            $newPoints = $status === 'Approved' ? $awardPoints : 0;
            $delta = $newPoints - $oldGrade;

            if ($delta !== 0) {
                $newScore = max(0, (int) $user->score + $delta);
                $user->update([
                    'score' => $newScore,
                    'level' => AuthService::levelFromScore($newScore),
                ]);

                PointsTransaction::create([
                    'username'    => $user->username,
                    'type'        => 'upskill_eval',
                    'points'      => $delta,
                    'description' => "ผลการประเมินบันทึกอัพสกิล: {$log->video_title} (" . ($delta >= 0 ? "+{$delta}" : "{$delta}") . " แต้ม)",
                ]);
            }
        }

        return response()->json([
            'status'   => 'success',
            'message'  => 'บันทึกผลการประเมินและอัปเดตแต้มสะสมเรียบร้อยแล้ว',
            'log'      => $this->learningLogArray($log->fresh()),
            'newScore' => $user ? (int) $user->score : null,
        ]);
    }

    private function learningLogArray(UpskillLearningLog $log): array
    {
        return [
            'id'          => (string) $log->id,
            'username'    => $log->username,
            'videoId'     => $log->video_id ? (string) $log->video_id : '',
            'videoTitle'  => $log->video_title ?? '',
            'categoryId'  => $log->category_id ? (string) $log->category_id : '',
            'notes'       => $log->content ?? '',
            'status'      => $log->status === 'Approved' ? 'graded' : strtolower($log->status),
            'score'       => $log->grade !== null ? (int) $log->grade : null,
            'feedback'    => $log->feedback ?? '',
            'submittedAt' => $log->created_at?->toIso8601String(),
            'gradedAt'    => $log->graded_at?->toIso8601String(),
        ];
    }

    private function isAdmin(Request $request): bool
    {
        return (AuthService::buildActorFromRequest($request)['role'] ?? null) === 'admin';
    }

    private function unauthenticated(): JsonResponse
    {
        return response()->json(['status' => 'error', 'message' => 'กรุณาเข้าสู่ระบบ'], 401);
    }

    private function forbidden(): JsonResponse
    {
        return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์'], 403);
    }
}
