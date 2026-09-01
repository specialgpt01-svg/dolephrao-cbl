<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\IdPlan;
use App\Models\IdPlanItem;
use App\Models\IdPlanLog;
use App\Models\User;
use App\Services\AuthService;
use App\Services\AIService;
use App\Services\CacheService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class IDPlanController extends Controller
{
    /**
     * ดึงข้อมูล ID Plan (รองรับทั้งผู้เรียน, ครู สกร. และ ปราชญ์ชาวบ้าน)
     */
    public function getIDPlans(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor) {
            return response()->json(['status' => 'error', 'message' => 'กรุณาเข้าสู่ระบบ'], 401);
        }

        $user = User::where('username', $actor['username'])->first();
        if (!$user) {
            return response()->json(['status' => 'error', 'message' => 'ไม่พบผู้ใช้งาน'], 404);
        }

        // ดึงแผนของผู้เรียนเป้าหมาย หรือ แผนของตนเอง
        $targetUsername = AuthService::normalizeUsername(
            $request->input('targetUsername') ?? $request->input('targetPhone') ??
            $request->input('username') ?? $request->input('phone') ?? ''
        );
        $targetUser = $targetUsername ? User::where('username', $targetUsername)->first() : $user;
        if (!$targetUser) {
            $targetUser = $user;
        }

        $plan = IdPlan::with(['items.source', 'items.base', 'items.sage', 'logs'])
            ->where('username', $targetUser->username)
            ->latest()
            ->first();

        if ($plan) {
            $plan->status = $plan->checkInactivityStatus();
            if ($plan->isDirty('status')) $plan->save();
        }

        // กรณีเป็นครู สกร. หรือ ปราชญ์ชาวบ้าน หรือ Admin -> จัดเตรียมรายการแผนทั้งหมดในความดูแลด้วย
        $plans = collect();
        $inDangerCount = 0;

        if (in_array($user->role, ['admin', 'superadmin', 'teacher', 'sage'])) {
            $query = IdPlan::with(['user', 'items.source', 'items.base', 'items.sage', 'logs']);

            $instId = trim($request->input('institutionId') ?? $request->input('institution_id') ?? '');
            if (!$instId && $user->institution_id !== 'ALL') {
                $instId = $user->institution_id;
            }
            if ($instId && $instId !== 'ALL' && $instId !== 'ทั้งหมด') {
                $query->whereHas('user', fn($q) => $q->where('institution_id', $instId));
            }

            if ($user->role === 'teacher') {
                $cleanTambon = AuthService::normalizeTambon($user->tambon);
                $query->whereHas('user', fn($q) => $q->where('tambon', $cleanTambon));
            } else if ($user->role === 'sage') {
                $query->where(function($q) use ($user) {
                    $q->where('sage_username', $user->username)
                      ->orWhereHas('items', fn($iq) => $iq->where('assigned_sage_username', $user->username));
                });
            }

            $plans = $query->latest()->get()->map(function($p) {
                $p->status = $p->checkInactivityStatus();
                return $p;
            });

            // คัดกรองรายชื่อเสี่ยงขาดเรียนเกิน 20 วัน (InDanger Risk Alerts)
            $inDangerCount = $plans->where('status', 'InDanger')->count();
        }

        return response()->json([
            'status'        => 'success',
            'plan'          => $plan,
            'plans'         => $plans,
            'inDangerCount' => $inDangerCount,
            'role'          => $user->role,
        ]);
    }

    /**
     * เรียกใช้งาน AI วิเคราะห์ผู้เรียนและสร้างร่างแผน ID Plan อัตโนมัติ
     */
    public function generateAIDraft(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor) {
            return response()->json(['status' => 'error', 'message' => 'กรุณาเข้าสู่ระบบ'], 401);
        }

        $targetUsername = $request->input('targetUsername') ?? $actor['username'];
        $user = User::where('username', $targetUsername)->first();
        if (!$user) {
            return response()->json(['status' => 'error', 'message' => 'ไม่พบผู้ใช้งาน'], 404);
        }

        $careerGoal = trim((string) $request->input('careerGoal', ''));
        $digitalLevel = trim((string) $request->input('digitalLevel', 'Basic'));

        $draft = AIService::generateIDPlanDraft($user, $careerGoal, $digitalLevel);

        return response()->json([
            'status' => 'success',
            'draft'  => $draft,
            'user'   => $user->toPublicArray(),
        ]);
    }

    /**
     * บันทึก/อัปเดต ID Plan (Co-Design ร่วมกันระหว่างครู/ผู้เรียน/ปราชญ์)
     */
    public function createOrUpdateIDPlan(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor) {
            return response()->json(['status' => 'error', 'message' => 'กรุณาเข้าสู่ระบบ'], 401);
        }

        $targetUsername = $request->input('username') ?? $actor['username'];
        $user = User::where('username', $targetUsername)->first();
        if (!$user) {
            return response()->json(['status' => 'error', 'message' => 'ไม่พบผู้ใช้งาน'], 404);
        }

        $title = trim((string) $request->input('title', 'แผนพัฒนาตนเองรายบุคคล'));
        $goal  = trim((string) $request->input('targetCareerGoal', ''));
        $level = trim((string) $request->input('initialDigitalLevel', 'Basic'));
        $strengths = $request->input('strengths', []);
        $gaps = $request->input('gaps', []);
        $items = $request->input('items', []);

        $plan = IdPlan::updateOrCreate(
            ['username' => $user->username],
            [
                'institution_id'            => $user->institution_id ?? 'INS_PHRAO',
                'teacher_username'          => $actor['role'] === 'teacher' ? $actor['username'] : null,
                'title'                     => $title,
                'target_career_goal'        => $goal,
                'initial_digital_level'     => $level,
                'strengths_json'            => is_array($strengths) ? $strengths : json_decode($strengths, true),
                'gaps_json'                 => is_array($gaps) ? $gaps : json_decode($gaps, true),
                'academic_target_hours'     => (float) ($request->input('academicTargetHours') ?? 15),
                'vocation_target_hours'     => (float) ($request->input('vocationTargetHours') ?? 20),
                'digital_target_hours'      => (float) ($request->input('digitalTargetHours') ?? 15),
                'status'                    => 'Active',
                'inactivity_days_threshold' => 20, // เกณฑ์ 20 วันตามสั่งการ
                'last_activity_at'          => now(),
                'target_completion_date'    => now()->addMonths(3),
            ]
        );

        // ล้างเป้าหมายเดิมและบันทึกเป้าหมายย่อยใหม่
        IdPlanItem::where('id_plan_id', $plan->id)->delete();

        if (is_array($items)) {
            foreach ($items as $it) {
                IdPlanItem::create([
                    'id_plan_id'             => $plan->id,
                    'category'               => $it['category'] ?? 'academic',
                    'source_id'              => $it['source_id'] ?? null,
                    'base_id'                => $it['base_id'] ?? null,
                    'activity_id'            => $it['activity_id'] ?? null,
                    'custom_item_title'      => $it['custom_item_title'] ?? 'หัวข้อการเรียนรู้',
                    'assigned_sage_username' => $it['assigned_sage_username'] ?? null,
                    'target_hours'           => (float) ($it['target_hours'] ?? 10),
                    'completed_hours'        => (float) ($it['completed_hours'] ?? 0),
                    'status'                 => $it['status'] ?? 'Pending',
                ]);
            }
        }

        CacheService::forgetUserProfile($user->username);

        return response()->json([
            'status'  => 'success',
            'message' => 'บันทึกแผนการเรียนรู้รายบุคคล (ID Plan) เรียบร้อยแล้ว!',
            'plan'    => $plan->load(['items.source', 'items.base', 'items.sage', 'logs']),
        ]);
    }

    /**
     * บันทึกการลงพื้นที่เยี่ยมบ้าน/แปลงเกษตร Re-Plan เมื่อผู้เรียนขาดเรียนเกิน 20 วัน
     */
    public function rePlanVisit(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor || !in_array($actor['role'], ['admin', 'teacher', 'sage'])) {
            return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์ดำเนินการ'], 403);
        }

        $planId = (int) $request->input('idPlanId');
        $plan = IdPlan::find($planId);
        if (!$plan) {
            return response()->json(['status' => 'error', 'message' => 'ไม่พบ ID Plan'], 404);
        }

        $reason = trim((string) $request->input('reasonForInactivity', ''));
        $action = trim((string) $request->input('actionTaken', ''));
        $newDate = $request->input('newCompletionDate');

        IdPlanLog::create([
            'id_plan_id'            => $plan->id,
            'visit_date'            => now()->toDateString(),
            'visited_by'            => $actor['username'],
            'reason_for_inactivity' => $reason,
            'action_taken'          => $action,
            'new_completion_date'   => $newDate ?: now()->addMonths(2)->toDateString(),
        ]);

        $plan->status = 'RePlanned';
        $plan->last_activity_at = now();
        if ($newDate) $plan->target_completion_date = $newDate;
        $plan->save();

        return response()->json([
            'status'  => 'success',
            'message' => 'บันทึกการลงพื้นที่เยี่ยมบ้าน Re-Plan และปรับสถานะเรียบร้อยแล้ว!',
            'plan'    => $plan->load(['items', 'logs']),
        ]);
    }

    /**
     * ปราชญ์ชาวบ้าน (Sage) กดรับรองผลทักษะภูมิปัญญาของผู้เรียน
     */
    public function approveSageItem(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor || !in_array($actor['role'], ['admin', 'teacher', 'sage'])) {
            return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์รับรองผล'], 403);
        }

        $itemId = (int) $request->input('itemId');
        $item = IdPlanItem::find($itemId);
        if (!$item) {
            return response()->json(['status' => 'error', 'message' => 'ไม่พบรายการในแผน'], 404);
        }

        $note = trim((string) $request->input('note', 'ได้รับการถ่ายทอดภูมิปัญญาท้องถิ่นจากปราชญ์ชาวบ้านเรียบร้อย'));

        $item->sage_approved = true;
        $item->sage_approved_at = now();
        $item->sage_note = $note;
        $item->status = 'Completed';
        $item->completed_hours = $item->target_hours;
        $item->save();

        // อัปเดตเวลาเรียนรู้ล่าสุดของแผนแม่
        $plan = IdPlan::find($item->id_plan_id);
        if ($plan) {
            $plan->last_activity_at = now();
            $plan->save();
        }

        return response()->json([
            'status'  => 'success',
            'message' => 'ปราชญ์ชาวบ้านรับรองผลทักษะภูมิปัญญารายการนี้เรียบร้อยแล้ว!',
            'item'    => $item,
        ]);
    }
}
