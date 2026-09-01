<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LearningLog;
use App\Models\PointsTransaction;
use App\Models\User;
use App\Services\AuthService;
use App\Services\CacheService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class LearningLogController extends Controller
{
    public function submitLog(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor || $actor['role'] === 'guest') {
            return response()->json(['status' => 'error', 'message' => 'กรุณาเข้าสู่ระบบ'], 401);
        }

        $activityName = trim((string) $request->input('activityName', ''));
        $description = trim((string) $request->input('description', ''));

        if ($activityName === '' || $description === '') {
            return response()->json(['status' => 'error', 'message' => 'กรุณากรอกชื่อกิจกรรมและรายละเอียดให้ครบถ้วน']);
        }

        $log = LearningLog::create([
            'log_id' => (string) Str::uuid(),
            'username' => $actor['username'],
            'activity_name' => $activityName,
            'description' => $description,
            'external_link' => trim((string) $request->input('externalLink', '')),
            'status' => 'Pending',
            'score' => 0,
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'ส่งบันทึกการเรียนรู้เรียบร้อยแล้ว กรุณารอครูตรวจ',
            'logId' => $log->log_id,
        ]);
    }

    public function getUserLogs(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor) {
            return response()->json(['status' => 'error', 'message' => 'กรุณาเข้าสู่ระบบ'], 401);
        }

        $target = AuthService::normalizeUsername((string) ($request->input('username') ?? $request->input('phone') ?? $actor['username']));
        if ($target !== $actor['username'] && !in_array($actor['role'], ['admin', 'teacher'], true)) {
            return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์ดูข้อมูลนี้'], 403);
        }

        if ($target !== $actor['username'] && $actor['role'] === 'teacher') {
            $targetUser = User::where('username', $target)->first();
            if (!$targetUser || AuthService::normalizeTambon((string) $targetUser->tambon) !== AuthService::normalizeTambon((string) $actor['tambon'])) {
                return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์ดูข้อมูลผู้เรียนนอกพื้นที่'], 403);
            }
        }

        $query = LearningLog::where('username', $target)->orderByDesc('created_at');
        if ($request->filled('startDate')) $query->whereDate('created_at', '>=', $request->input('startDate'));
        if ($request->filled('endDate')) $query->whereDate('created_at', '<=', $request->input('endDate'));

        $paginator = $query->paginate(10, ['*'], 'page', max(1, (int) $request->input('page', 1)));
        $data = collect($paginator->items())->map(fn (LearningLog $log) => $this->toFrontendArray($log))->values();

        return response()->json([
            'status' => 'success',
            'data' => $data,
            'currentPage' => $paginator->currentPage(),
            'totalPages' => max(1, $paginator->lastPage()),
        ]);
    }

    public function getPendingLogs(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor || !in_array($actor['role'], ['admin', 'teacher'], true)) {
            return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์'], 403);
        }

        $query = LearningLog::with('user')->where('status', 'Pending')->orderByDesc('created_at');
        
        $instId = trim($request->input('institutionId') ?? $request->input('institution_id') ?? '');
        if (!$instId && $actor['institution_id'] !== 'ALL') {
            $instId = $actor['institution_id'];
        }
        if ($instId && $instId !== 'ALL' && $instId !== 'ทั้งหมด') {
            $query->whereHas('user', fn ($q) => $q->where('institution_id', $instId));
        }

        if ($actor['role'] === 'teacher') {
            $tambon = AuthService::normalizeTambon((string) $actor['tambon']);
            $query->whereHas('user', fn ($q) => $q->where('tambon', $tambon));
        }

        $data = $query->limit(500)->get()->map(fn (LearningLog $log) => array_merge(
            $this->toFrontendArray($log),
            [
                'phone' => $log->user?->phone ?? $log->username,
                'fullName' => $log->user?->full_name ?? '',
                'tambon' => $log->user?->tambon ?? '',
            ]
        ));

        return response()->json($data);
    }

    public function reviewLog(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor || !in_array($actor['role'], ['admin', 'teacher'], true)) {
            return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์'], 403);
        }

        $status = (string) $request->input('status', 'Rejected');
        if (!in_array($status, ['Approved', 'Rejected'], true)) {
            return response()->json(['status' => 'error', 'message' => 'สถานะไม่ถูกต้อง']);
        }

        $log = LearningLog::with('user')->where('log_id', $request->input('logId'))->first();
        if (!$log) return response()->json(['status' => 'error', 'message' => 'ไม่พบบันทึก']);

        if ($actor['institution_id'] !== 'ALL' && $log->user?->institution_id && $log->user->institution_id !== $actor['institution_id']) {
            return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์ตรวจงานต่างสถานศึกษา'], 403);
        }

        if ($actor['role'] === 'teacher' && AuthService::normalizeTambon((string) $log->user?->tambon) !== AuthService::normalizeTambon((string) $actor['tambon'])) {
            return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์ตรวจงานนอกพื้นที่'], 403);
        }

        $newScore = $status === 'Approved' ? max(0, (int) $request->input('score', 0)) : 0;

        DB::transaction(function () use ($log, $actor, $status, $newScore, $request) {
            $lockedLog = LearningLog::whereKey($log->id)->lockForUpdate()->firstOrFail();
            $user = User::where('username', $lockedLog->username)->lockForUpdate()->firstOrFail();
            $oldScore = $lockedLog->status === 'Approved' ? (int) $lockedLog->score : 0;
            $delta = $newScore - $oldScore;

            $lockedLog->update([
                'status' => $status,
                'score' => $newScore,
                'note' => trim((string) $request->input('note', '')),
                'reviewed_at' => now(),
                'reviewed_by' => $actor['username'],
            ]);

            if ($delta !== 0) {
                $score = max(0, (int) $user->score + $delta);
                $user->update(['score' => $score, 'level' => AuthService::levelFromScore($score)]);
                PointsTransaction::create([
                    'username' => $user->username,
                    'type' => 'learning_log_review',
                    'description' => 'ผลประเมินบันทึกการเรียนรู้: '.$lockedLog->activity_name,
                    'points' => $delta,
                    'ref_id' => $lockedLog->log_id,
                ]);
            }
        });

        CacheService::invalidateLeaderboard();
        return response()->json(['status' => 'success']);
    }

    private function toFrontendArray(LearningLog $log): array
    {
        return [
            'logId' => $log->log_id,
            'activityName' => $log->activity_name,
            'description' => $log->description,
            'externalLink' => $log->external_link ?? '',
            'status' => $log->status,
            'score' => (float) $log->score,
            'note' => $log->note ?? '',
            'date' => $log->created_at?->format('d/m/Y H:i'),
        ];
    }
}
