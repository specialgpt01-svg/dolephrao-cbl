<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\NfeHour;
use App\Models\PointsTransaction;
use App\Models\User;
use App\Services\AuthService;
use App\Services\CacheService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class NfeController extends Controller
{
    private const POINTS_PER_HOUR = 100;
    private const MAX_HOURS_PER_YEAR = 50;

    public function redeemNFEHours(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor) {
            return response()->json(['status' => 'error', 'message' => 'กรุณาเข้าสู่ระบบ'], 401);
        }

        $pointsSpent = max(0, (int) ($request->input('pointsSpent') ?? $request->input('points') ?? 0));
        $hours = (float) ($request->input('hours') ?? ($pointsSpent / self::POINTS_PER_HOUR));
        if ($pointsSpent <= 0 || $hours <= 0 || abs($hours - ($pointsSpent / self::POINTS_PER_HOUR)) > 0.001) {
            return response()->json(['status' => 'error', 'message' => 'อัตราแลกคะแนนไม่ถูกต้อง']);
        }

        try {
            $result = DB::transaction(function () use ($actor, $hours, $pointsSpent) {
                $user = User::where('username', $actor['username'])->lockForUpdate()->firstOrFail();
                $usedThisYear = (float) NfeHour::where('username', $actor['username'])
                    ->whereYear('created_at', now()->year)
                    ->sum('hours');
                if ($usedThisYear + $hours > self::MAX_HOURS_PER_YEAR) {
                    throw new \DomainException('จำนวนชั่วโมงเกินโควตาประจำปี');
                }
                if ((int) $user->score < $pointsSpent) {
                    throw new \DomainException('คะแนนไม่เพียงพอ');
                }

                $nfe = NfeHour::create([
                    'username' => $actor['username'],
                    'hours' => $hours,
                    'points_spent' => $pointsSpent,
                    'status' => 'Active',
                ]);
                $newScore = (int) $user->score - $pointsSpent;
                $user->update(['score' => $newScore, 'level' => AuthService::levelFromScore($newScore)]);
                PointsTransaction::create([
                    'username' => $actor['username'],
                    'type' => 'nfe_redeem',
                    'description' => "แลกชั่วโมง กพช. {$hours} ชม.",
                    'points' => -$pointsSpent,
                    'ref_id' => (string) $nfe->id,
                ]);

                $totalActive = (float) NfeHour::where('username', $actor['username'])
                    ->where('status', 'Active')
                    ->sum('hours');
                return compact('nfe', 'newScore', 'totalActive');
            });
        } catch (\DomainException $e) {
            return response()->json(['status' => 'error', 'message' => $e->getMessage()]);
        }

        CacheService::invalidateLeaderboard();
        return response()->json([
            'status' => 'success',
            'message' => 'แลกชั่วโมง กพช. สำเร็จ',
            'nfeId' => $result['nfe']->id,
            'redemptionId' => (string) $result['nfe']->id,
            'hoursGranted' => $hours,
            'newScore' => $result['newScore'],
            'totalNFEHours' => $result['totalActive'],
        ]);
    }

    public function getNFEHistory(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        $username = $actor['username'] ?? '';

        if (!$username) {
            $phone = trim($request->input('phone') ?? $request->input('username') ?? '');
            if ($phone) {
                $user = User::where('phone', $phone)->orWhere('username', $phone)->first();
                if ($user) {
                    $username = $user->username;
                }
            }
        }

        if (!$username) {
            return response()->json(['status' => 'error', 'message' => 'กรุณาเข้าสู่ระบบ'], 401);
        }

        $query = NfeHour::where('username', $username);
        $usedThisYear = (float) (clone $query)->whereYear('created_at', now()->year)->sum('hours');
        $totalActive = (float) (clone $query)->where('status', 'Active')->sum('hours');
        $data = $query->orderByDesc('created_at')->get()->map(fn (NfeHour $nfe) => $this->nfeArray($nfe));

        return response()->json([
            'status' => 'success',
            'data' => $data,
            'usedThisYear' => $usedThisYear,
            'remainingThisYear' => max(0, self::MAX_HOURS_PER_YEAR - $usedThisYear),
            'maxPerYear' => self::MAX_HOURS_PER_YEAR,
            'totalNFEHours' => $totalActive,
        ]);
    }

    public function getNFEAdminReport(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor || !in_array($actor['role'], ['admin', 'teacher'], true)) {
            return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์'], 403);
        }

        $query = NfeHour::with(['user' => fn ($q) => $q->select('username', 'full_name', 'tambon', 'institution_id')]);

        $instId = trim($request->input('institutionId') ?? $request->input('institution_id') ?? '');
        if (!$instId && $actor['institution_id'] !== 'ALL') {
            $instId = $actor['institution_id'];
        }
        if ($instId && $instId !== 'ALL' && $instId !== 'ทั้งหมด') {
            $query->whereHas('user', fn ($q) => $q->where('institution_id', $instId));
        }

        if ($actor['role'] === 'teacher') {
            $query->whereHas('user', fn ($q) => $q->where('tambon', AuthService::normalizeTambon($actor['tambon'])));
        } elseif ($request->filled('tambon') && !in_array($request->input('tambon'), ['ทั้งหมด', 'all'], true)) {
            $query->whereHas('user', fn ($q) => $q->where('tambon', AuthService::normalizeTambon($request->input('tambon'))));
        }

        $summaryQuery = clone $query;
        $summaryRows = $summaryQuery->get();
        $page = max(1, (int) $request->input('page', 1));
        $perPage = 50;
        $total = $summaryRows->count();
        $rows = $query->orderByDesc('created_at')->forPage($page, $perPage)->get()->map(function (NfeHour $nfe) {
            return array_merge($this->nfeArray($nfe), [
                'username' => $nfe->username,
                'fullName' => $nfe->user?->full_name ?? '',
                'tambon' => $nfe->user?->tambon ?? '',
            ]);
        });

        return response()->json([
            'status' => 'success',
            'data' => $rows,
            'summary' => [
                'totalHours' => (float) $summaryRows->sum('hours'),
                'uniqueUsers' => $summaryRows->pluck('username')->unique()->count(),
                'totalRecords' => $total,
            ],
            'page' => $page,
            'totalPages' => max(1, (int) ceil($total / $perPage)),
        ]);
    }

    public function useNFEHours(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor || !in_array($actor['role'], ['admin', 'teacher'], true)) {
            return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์'], 403);
        }

        $nfe = NfeHour::with('user')->find($request->input('redemptionId') ?? $request->input('nfeId'));
        if (!$nfe) {
            return response()->json(['status' => 'error', 'message' => 'ไม่พบรายการ กพช.']);
        }
        if ($actor['institution_id'] !== 'ALL' && $nfe->user?->institution_id && $nfe->user->institution_id !== $actor['institution_id']) {
            return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์ใช้รายการ กพช. ต่างสถานศึกษา'], 403);
        }
        if ($actor['role'] === 'teacher' && AuthService::normalizeTambon($nfe->user?->tambon) !== AuthService::normalizeTambon($actor['tambon'])) {
            return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์ใช้รายการต่างตำบล'], 403);
        }
        if ($nfe->status !== 'Active') {
            return response()->json(['status' => 'error', 'message' => 'รายการนี้ถูกใช้ไปแล้ว']);
        }

        $nfe->update([
            'status' => 'Used',
            'note' => trim((string) $request->input('note', '')),
            'reviewed_at' => now(),
            'reviewed_by' => $actor['username'],
        ]);
        return response()->json(['status' => 'success', 'redemptionId' => (string) $nfe->id]);
    }

    private function nfeArray(NfeHour $nfe): array
    {
        return [
            'id' => $nfe->id,
            'redemptionId' => (string) $nfe->id,
            'hours' => $nfe->hours,
            'hoursGranted' => $nfe->hours,
            'pointsSpent' => $nfe->points_spent,
            'pointsUsed' => $nfe->points_spent,
            'status' => $nfe->status,
            'note' => $nfe->note ?? '',
            'date' => $nfe->created_at?->format('d/m/Y'),
            'createdAt' => $nfe->created_at?->format('d/m/Y H:i'),
        ];
    }
}
