<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Certificate;
use App\Models\Quiz;
use App\Models\QuizLog;
use App\Models\Source;
use App\Models\User;
use App\Services\AuthService;
use App\Services\CacheService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class QuizController extends Controller
{
    /** getQuizzes — สำหรับผู้เรียนดึงข้อสอบ */
    public function getQuizzes(Request $request): JsonResponse
    {
        $sourceId = trim($request->input('sourceId') ?? $request->query('sourceId') ?? '');
        $baseId   = trim($request->input('baseId') ?? $request->query('baseId') ?? '');
        $quizType = strtolower(trim($request->input('type') ?? $request->query('type') ?? $request->input('quizType') ?? $request->query('quizType') ?? ''));

        // Normalize short form → full form (frontend sends 'pre'/'post', DB stores 'pretest'/'posttest')
        if ($quizType === 'pre')  $quizType = 'pretest';
        if ($quizType === 'post') $quizType = 'posttest';

        $query = Quiz::query();
        if ($sourceId) $query->where('source_id', $sourceId);
        if ($baseId)   $query->where('base_id', $baseId);
        if ($quizType) $query->where('quiz_type', $quizType);

        $quizzesCollection = $query->orderBy('display_order')->get();

        // Fallback: หากฐานนี้มีแค่ก่อนเรียนหรือหลังเรียนอย่างใดอย่างหนึ่ง ให้ใช้ชุดที่มีแทนอัตโนมัติ (สลับลำดับข้อ)
        if ($quizzesCollection->isEmpty() && $quizType) {
            $otherType = ($quizType === 'pretest') ? 'posttest' : 'pretest';
            $fallbackQuery = Quiz::query();
            if ($sourceId) $fallbackQuery->where('source_id', $sourceId);
            if ($baseId)   $fallbackQuery->where('base_id', $baseId);
            $fallbackQuery->where('quiz_type', $otherType);
            $quizzesCollection = $fallbackQuery->orderBy('display_order')->get();
            if ($quizzesCollection->isNotEmpty()) {
                $quizzesCollection = $quizzesCollection->reverse()->values();
            }
        }

        $quizzes = $quizzesCollection->map(function($q) {
            // choices is stored as JSON in the 'choices' column
            $choices = $q->choices ?? [];
            if (is_string($choices)) {
                $choices = json_decode($choices, true) ?? [];
            }
            // Fallback: try individual columns (legacy support)
            if (empty($choices)) {
                $choices = array_values(array_filter([
                    $q->choice_a ?? null,
                    $q->choice_b ?? null,
                    $q->choice_c ?? null,
                    $q->choice_d ?? null,
                ]));
            }
            return [
                'id'        => $q->id,
                'question'  => $q->question,
                'choices'   => array_values($choices),
                'quiz_type' => $q->quiz_type,
            ];
        });

        return response()->json(['status' => 'success', 'quizzes' => $quizzes]);
    }

    public function getAdminQuizBySource(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor || !in_array($actor['role'], ['admin', 'teacher'])) {
            return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์']);
        }

        $sourceId = trim($request->input('sourceId') ?? '');
        $baseId   = trim($request->input('baseId') ?? '');
        $quizType = strtolower(trim($request->input('quizType') ?? ''));

        $query = Quiz::query();
        if ($sourceId) $query->where('source_id', $sourceId);
        if ($baseId)   $query->where('base_id', $baseId);
        if ($quizType) $query->where('quiz_type', $quizType);

        $data = $query->orderBy('display_order')->get()->map(fn($q) => $q->toAdminArray());
        return response()->json(['status' => 'success', 'data' => $data]);
    }

    /** submitQuiz — ส่งคำตอบข้อสอบ */
    public function submitQuiz(Request $request): JsonResponse
    {
        $data     = $request->all();
        $actor    = AuthService::buildActorFromRequest($request);
        $username = $actor['username'] ?? '';
        $sourceId = trim($data['sourceId'] ?? '');
        $baseId   = trim($data['baseId'] ?? '');
        $mode     = strtolower(trim($data['mode'] ?? $data['quizType'] ?? ''));
        if ($mode === 'pre') $mode = 'pretest';
        if ($mode === 'post') $mode = 'posttest';
        $answers  = $data['answers'] ?? [];

        if (!$username) return response()->json(['status' => 'error', 'message' => 'กรุณาเข้าสู่ระบบ'], 401);
        if (!$sourceId) return response()->json(['status' => 'error', 'message' => 'ไม่พบแหล่งเรียนรู้']);

        $user = User::where('username', $username)->first();
        if (!$user) return response()->json(['status' => 'error', 'message' => 'ไม่พบผู้ใช้ในระบบ']);

        // โหลดข้อสอบ
        $quizQuery = Quiz::where('source_id', $sourceId);
        if ($baseId) $quizQuery->where('base_id', $baseId);
        if ($mode)   $quizQuery->where('quiz_type', $mode);
        $quizzes = $quizQuery->orderBy('display_order')->get();

        // Fallback หากไม่มีข้อสอบโหมดที่ระบุ ให้ใช้ชุดที่มีแทน
        if ($quizzes->isEmpty() && $mode) {
            $otherMode = ($mode === 'pretest') ? 'posttest' : 'pretest';
            $fallbackQuery = Quiz::where('source_id', $sourceId);
            if ($baseId) $fallbackQuery->where('base_id', $baseId);
            $fallbackQuery->where('quiz_type', $otherMode);
            $quizzes = $fallbackQuery->orderBy('display_order')->get();
        }

        if ($quizzes->isEmpty()) {
            return response()->json(['status' => 'error', 'message' => 'ไม่พบข้อสอบ']);
        }

        // ตรวจคำตอบ
        $correct = 0;
        $total   = $quizzes->count();
        foreach ($quizzes as $quiz) {
            $userAnswer = strtoupper(trim($answers[$quiz->id] ?? $answers[(string)$quiz->id] ?? ''));
            if ($userAnswer === strtoupper(trim($quiz->answer))) {
                $correct++;
            }
        }

        $score  = $total > 0 ? round(($correct / $total) * 100, 2) : 0;
        $passScore = 80;
        $passed = $score >= $passScore;
        $status = $passed ? 'Pass' : 'Fail';

        $pointsEarned = 0;
        $newScore = (int) $user->score;
        $log = null;

        if (($data['mode'] ?? '') === 'pretest') {
            return response()->json([
                'status' => 'success', 'quizStatus' => $status, 'score' => $score,
                'correct' => $correct, 'total' => $total, 'passed' => $passed,
                'pointsEarned' => 0, 'newScore' => $newScore,
            ]);
        }

        $source = Source::find($sourceId);
        $sourceName = $source ? $source->name : $sourceId;
        $totalPoints = 100;
        if ($source && !empty($source->info['points']) && is_numeric($source->info['points'])) {
            $totalPoints = (int) $source->info['points'];
        }
        $maxQuizPoints = (int) round($totalPoints / 2);
        $calculatedQuizPoints = (int) round(($score / 100) * $maxQuizPoints);

        DB::transaction(function () use ($username, $sourceId, $baseId, $sourceName, $score, $status, $passed, $correct, $calculatedQuizPoints, &$pointsEarned, &$newScore, &$log) {
            $user = User::where('username', $username)->lockForUpdate()->firstOrFail();
            $log = QuizLog::where('username', $username)
                ->where('source_id', $sourceId)
                ->where('base_id', $baseId ?: null)
                ->lockForUpdate()
                ->first();

            $alreadyPassed = $log?->status === 'Pass';
            $log = QuizLog::updateOrCreate(
                ['username' => $username, 'source_id' => $sourceId, 'base_id' => $baseId ?: null],
                ['score' => $score, 'status' => $status]
            );

            if ($passed && !$alreadyPassed) {
                $pointsEarned = $calculatedQuizPoints;
                $newScore = (int) $user->score + $pointsEarned;
                $user->update(['score' => $newScore, 'level' => AuthService::levelFromScore($newScore)]);
                \App\Models\PointsTransaction::create([
                    'username'    => $username,
                    'type'        => 'quiz_pass',
                    'description' => "ทำแบบทดสอบ: {$sourceName} ได้ {$score}% (รับแต้มส่วนที่สอง +{$pointsEarned} แต้ม)",
                    'points'      => $pointsEarned,
                    'ref_id'      => (string) $log->id,
                ]);
            } else {
                $newScore = (int) $user->score;
            }

            if ($passed && !empty($sourceId)) {
                $yearThai = (int) date('Y') + 543;
                $seq = Certificate::count() + 1;
                $refNo = 'สกร.พร้าว/' . $yearThai . '-' . str_pad($seq, 4, '0', STR_PAD_LEFT);

                Certificate::firstOrCreate(
                    [
                        'username'  => $username,
                        'source_id' => $sourceId,
                        'base_id'   => null, // 1 แหล่งเรียนรู้ = 1 ใบเกียรติบัตร
                    ],
                    [
                        'cert_no'   => $refNo,
                        'issued_at' => now(),
                        'status'    => 'Active',
                    ]
                );
            }
        });

        if ($pointsEarned > 0) CacheService::invalidateLeaderboard();

        return response()->json([
            'status'       => 'success',
            'quizStatus'   => $status,
            'score'        => $score,
            'correct'      => $correct,
            'total'        => $total,
            'passed'       => $passed,
            'pointsEarned' => $pointsEarned,
            'logId'        => $log->id,
            'newScore'     => $newScore,
        ]);
    }

    /** saveAdminQuiz */
    public function saveAdminQuiz(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor || !in_array($actor['role'], ['admin', 'teacher'])) {
            return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์']);
        }

        $mode     = strtolower(trim($request->input('mode') ?? 'create'));
        $quizId   = $request->input('quizId');
        $sourceId = trim($request->input('sourceId') ?? '');
        $baseId   = trim($request->input('baseId') ?? '');
        $quizType = strtolower(trim($request->input('quizType') ?? 'posttest'));
        $question = trim($request->input('question') ?? '');
        $choices  = $request->input('choices') ?? [];
        $answer   = strtoupper(trim($request->input('answer') ?? ''));
        $order    = (int) ($request->input('displayOrder') ?? 999);

        if (!$sourceId) return response()->json(['status' => 'error', 'message' => 'กรุณาระบุรหัสแหล่งเรียนรู้']);
        if (!$question) return response()->json(['status' => 'error', 'message' => 'กรุณากรอกคำถาม']);
        if (empty($choices)) return response()->json(['status' => 'error', 'message' => 'กรุณาระบุตัวเลือก']);
        if (!$answer) return response()->json(['status' => 'error', 'message' => 'กรุณาระบุคำตอบที่ถูกต้อง']);

        if ($mode === 'edit' && $quizId) {
            $quiz = Quiz::find($quizId);
            if (!$quiz) return response()->json(['status' => 'error', 'message' => 'ไม่พบข้อสอบ']);
            $quiz->update(['question' => $question, 'choices' => $choices, 'answer' => $answer, 'display_order' => $order, 'quiz_type' => $quizType]);
        } else {
            $quiz = Quiz::create([
                'source_id'     => $sourceId,
                'base_id'       => $baseId ?: null,
                'quiz_type'     => $quizType,
                'question'      => $question,
                'choices'       => $choices,
                'answer'        => $answer,
                'display_order' => $order,
            ]);
        }

        return response()->json(['status' => 'success', 'quizId' => $quiz->id]);
    }

    /** saveAdminQuizBatch — บันทึกข้อสอบทั้งหมดพร้อมกัน (Atomic Sync) */
    public function saveAdminQuizBatch(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor || !in_array($actor['role'], ['admin', 'teacher'])) {
            return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์']);
        }

        $sourceId = trim($request->input('sourceId') ?? '');
        $baseId   = trim($request->input('baseId') ?? '');
        $quizType = strtolower(trim($request->input('quizType') ?? 'posttest'));
        $quizzes  = $request->input('quizzes') ?? [];

        if (!$sourceId) return response()->json(['status' => 'error', 'message' => 'กรุณาระบุรหัสแหล่งเรียนรู้']);

        $saved = 0;
        DB::transaction(function () use ($sourceId, $baseId, $quizType, $quizzes, &$saved) {
            $query = Quiz::where('source_id', $sourceId)->where('quiz_type', $quizType);
            if ($baseId) {
                $query->where('base_id', $baseId);
            } else {
                $query->whereNull('base_id');
            }
            $query->delete();

            foreach ($quizzes as $idx => $q) {
                $question = trim($q['question'] ?? '');
                if (!$question) continue;

                $choices = $q['choices'] ?? [];
                if (is_string($choices)) {
                    $choices = json_decode($choices, true) ?? [];
                }
                $answer = strtoupper(trim($q['answer'] ?? 'A'));
                if (!in_array($answer, ['A', 'B', 'C', 'D'])) {
                    $answer = 'A';
                }

                Quiz::create([
                    'source_id'     => $sourceId,
                    'base_id'       => $baseId ?: null,
                    'quiz_type'     => $quizType,
                    'question'      => $question,
                    'choices'       => array_values($choices),
                    'answer'        => $answer,
                    'display_order' => $idx + 1,
                ]);
                $saved++;
            }
        });

        return response()->json(['status' => 'success', 'saved' => $saved]);
    }

    /** deleteAdminQuiz */
    public function deleteAdminQuiz(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor || !in_array($actor['role'], ['admin', 'teacher'])) {
            return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์']);
        }

        $quizId = $request->input('quizId');
        if (!$quizId) return response()->json(['status' => 'error', 'message' => 'ไม่พบรหัสข้อสอบ']);

        Quiz::destroy($quizId);
        return response()->json(['status' => 'success']);
    }

    /** saveAdminQuizOrder */
    public function saveAdminQuizOrder(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor || !in_array($actor['role'], ['admin', 'teacher'])) {
            return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์']);
        }

        $quizIds = (array) ($request->input('quizIds') ?? []);
        foreach ($quizIds as $idx => $id) {
            Quiz::where('id', $id)->update(['display_order' => $idx + 1]);
        }

        return response()->json(['status' => 'success']);
    }

    /** importAdminQuizCsv — Import จาก CSV */
    public function importAdminQuizCsv(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor || !in_array($actor['role'], ['admin', 'teacher'])) {
            return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์']);
        }

        $sourceId = trim($request->input('sourceId') ?? '');
        $baseId   = trim($request->input('baseId') ?? '');
        $quizType = strtolower(trim($request->input('quizType') ?? 'posttest'));
        $csvData  = $request->input('csv') ?? '';

        if (!$sourceId) return response()->json(['status' => 'error', 'message' => 'กรุณาระบุรหัสแหล่งเรียนรู้']);
        if (!$csvData)  return response()->json(['status' => 'error', 'message' => 'ไม่พบข้อมูล CSV']);

        $lines  = explode("\n", trim($csvData));
        $saved  = 0;
        $errors = [];

        foreach ($lines as $lineNo => $line) {
            if ($lineNo === 0) continue; // skip header
            $cols = str_getcsv(trim($line));
            if (count($cols) < 6) {
                $errors[] = "แถว {$lineNo}: ข้อมูลไม่ครบ";
                continue;
            }
            [$question, $a, $b, $c, $d, $answer] = $cols;
            Quiz::create([
                'source_id'     => $sourceId,
                'base_id'       => $baseId ?: null,
                'quiz_type'     => $quizType,
                'question'      => trim($question),
                'choices'       => [trim($a), trim($b), trim($c), trim($d)],
                'answer'        => strtoupper(trim($answer)),
                'display_order' => $saved + 1,
            ]);
            $saved++;
        }

        return response()->json(['status' => 'success', 'saved' => $saved, 'errors' => $errors]);
    }
}
