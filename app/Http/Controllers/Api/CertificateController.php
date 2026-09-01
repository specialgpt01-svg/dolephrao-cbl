<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Certificate;
use App\Models\Coupon;
use App\Models\LearningLog;
use App\Models\PointsTransaction;
use App\Models\SpinTransaction;
use App\Models\User;
use App\Models\QuizLog;
use App\Models\Source;
use App\Models\Base;
use App\Models\Activity;
use App\Models\ActivityCheckIn;
use App\Models\Setting;
use App\Services\AuthService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Storage;

class CertificateController extends Controller
{
    public function saveCertUrl(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        $username = $actor['username'] ?? '';
        $sourceId = trim($request->input('sourceId') ?? '');
        $baseId   = trim($request->input('baseId') ?? '');
        $activityId = trim($request->input('activityId') ?? '');
        $certUrl  = trim($request->input('certUrl') ?? '');

        if (!$username || !$certUrl) {
            return response()->json(['status' => 'error', 'message' => 'ข้อมูลไม่ครบ']);
        }

        Certificate::updateOrCreate(
            ['username' => $username, 'source_id' => $sourceId ?: null, 'base_id' => $baseId ?: null, 'activity_id' => $activityId ?: null],
            ['cert_url' => $certUrl, 'cert_no' => 'CERT-' . strtoupper(Str::random(8)), 'issued_at' => now()]
        );

        return response()->json(['status' => 'success']);
    }

    public function getCertEditorSources(Request $request): JsonResponse
    {
        $institutions = class_exists(\App\Models\Institution::class)
            ? \App\Models\Institution::all()->map(fn($i) => [
                'id' => $i->id,
                'name' => $i->name,
                'code' => $i->code,
                'tambons' => $i->tambons,
            ])->values()->toArray()
            : [];

        $sources = Source::orderBy('name')->get()->map(function($s) {
            $hasCustom = !empty($s->cert_template) && is_array($s->cert_template) && (!empty($s->cert_template['backgroundUrl']) || !empty($s->cert_template['certNameFontSize']));
            return [
                'id' => $s->id,
                'name' => $s->name,
                'tambon' => $s->tambon,
                'institution_id' => $s->institution_id ?? 'INS_PHRAO',
                'hasCustom' => $hasCustom,
                'backgroundUrl' => $s->cert_template['backgroundUrl'] ?? ''
            ];
        });

        // Also fetch Activities for Certificate Studio
        $activities = Activity::orderBy('name')->get()->map(function($a) {
            $tmpl = $a->certificate_template;
            if (is_string($tmpl)) {
                try { $tmpl = json_decode($tmpl, true); } catch(\Exception $e) { $tmpl = null; }
            }
            $hasCustom = !empty($tmpl) && is_array($tmpl) && (!empty($tmpl['backgroundUrl']) || !empty($tmpl['certNameFontSize']) || !empty($tmpl['courseName']));
            return [
                'id' => $a->id,
                'name' => $a->name,
                'tambon' => $a->tambon ?? '',
                'institution_id' => $a->institution_id ?? 'INS_PHRAO',
                'hasCustom' => $hasCustom,
                'backgroundUrl' => is_array($tmpl) ? ($tmpl['backgroundUrl'] ?? '') : ''
            ];
        });

        // Fallback merge quarter activities if any not yet in activities
        $quarterActs = \App\Models\QuarterActivity::all();
        foreach ($quarterActs as $qa) {
            if (!$activities->contains('id', $qa->id)) {
                $activities->push([
                    'id' => $qa->id,
                    'name' => $qa->activity_name,
                    'tambon' => $qa->tambon ?? '',
                    'institution_id' => $qa->institution_id ?? 'INS_PHRAO',
                    'hasCustom' => false,
                    'backgroundUrl' => ''
                ]);
            }
        }

        return response()->json([
            'status' => 'success',
            'institutions' => $institutions,
            'sources' => $sources,
            'activities' => $activities->values(),
            'bases' => []
        ]);
    }

    public function getCertTemplate(Request $request): JsonResponse
    {
        $target = trim((string) ($request->input('target') ?? $request->input('activityId') ?? 'global'));
        $globalSettings = Setting::get('global_settings', []);
        if (!is_array($globalSettings)) $globalSettings = [];

        $template = null;
        $targetType = 'global';
        $targetId = '';
        $targetName = 'ค่าเริ่มต้นของระบบ (Global Default)';

        if ($target !== 'global' && !empty($target)) {
            if (str_starts_with($target, 'activity:') || str_starts_with($target, 'act:')) {
                $actId = preg_replace('/^(activity:|act:)/i', '', $target);
                $act = Activity::find($actId) ?: Activity::whereRaw('LOWER(id) = ?', [strtolower($actId)])->first();
                if (!$act) {
                    $act = (new ActivityController)->findOrCreateActivityRecord($actId);
                }
                if ($act) {
                    $targetId = $act->id;
                    $targetType = 'activity';
                    $targetName = $act->name;
                    $tmpl = $act->certificate_template;
                    $template = is_string($tmpl) ? json_decode($tmpl, true) : $tmpl;
                }
            } else {
                $sourceId = str_replace('source:', '', $target);
                if (str_starts_with($target, 'base:')) {
                    $baseId = str_replace('base:', '', $target);
                    $base = Base::find($baseId);
                    $sourceId = $base?->source_id ?: '';
                }
                if ($sourceId) {
                    $targetId = $sourceId;
                    $targetType = 'source';
                    $source = Source::find($sourceId);
                    if ($source) {
                        $targetName = $source->name;
                        $template = $source->cert_template;
                    }
                }
            }
        }

        $defaultConfig = [
            'backgroundUrl' => '',
            'certHeader' => 'ศูนย์ส่งเสริมการเรียนรู้ระดับอำเภอพร้าว',
            'certHeaderFontSize' => 42,
            'certHeaderColor' => '#064e3b',
            'certHeaderMarginTop' => 154,
            'certHeaderSub' => 'กรมส่งเสริมการเรียนรู้ กระทรวงศึกษาธิการ',
            'certHeaderSubFontSize' => 23,
            'certHeaderSubColor' => '#475569',
            'certHeaderSubMarginTop' => 19,
            'certSubtitle' => 'ขอมอบไว้เพื่อแสดงว่า',
            'certSubtitleFontSize' => 20,
            'certSubtitleColor' => '#334155',
            'certSubtitleMarginTop' => 19,
            'certNameFontSize' => 33,
            'certNameColor' => '#064e3b',
            'certNameMarginTop' => -10,
            'certDesc' => 'ได้ผ่านการประเมินความรู้ตามเกณฑ์การเรียนรู้เรื่อง',
            'certDescFontSize' => 20,
            'certDescColor' => '#334155',
            'certDescMarginTop' => 18,
            'certSubjectFontSize' => 25,
            'certSubjectColor' => '#064e3b',
            'certSubjectMarginTop' => 12,
            'certDatePrefix' => 'ให้ไว้ ณ วันที่',
            'certDateFontSize' => 19,
            'certDateColor' => '#334155',
            'certDateMarginTop' => 19,
            'directorName' => 'นายประวิตร ประธรรมโย',
            'directorTitle' => 'ผู้อำนวยการ สกร.ระดับอำเภอพร้าว',
            'certSigFontSize' => 16,
            'certSigColor' => '#0f172a',
            'certSigMarginTop' => -21
        ];

        $isCustom = !empty($template) && is_array($template) && (!empty($template['backgroundUrl']) || !empty($template['certNameFontSize']) || !empty($template['certHeader']));
        $mergedGlobal = array_merge($defaultConfig, $globalSettings);
        $mergedTemplate = array_merge($mergedGlobal, is_array($template) ? $template : []);

        return response()->json([
            'status' => 'success',
            'target' => $target,
            'targetType' => $targetType,
            'targetId' => $targetId,
            'targetName' => $targetName,
            'isCustom' => $isCustom,
            'template' => $mergedTemplate,
            'globalSettings' => $mergedGlobal
        ]);
    }

    public function saveCertTemplate(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor || !in_array($actor['role'] ?? '', ['admin', 'teacher'])) {
            return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์ในการบันทึกการตั้งค่า'], 403);
        }

        $target = trim((string) ($request->input('target') ?? 'global'));
        $incoming = $request->input('template') ?? $request->input('settings') ?? [];
        if (is_string($incoming)) {
            $incoming = json_decode($incoming, true) ?: [];
        }

        if ($target === 'global' || empty($target)) {
            $global = Setting::get('global_settings', []);
            if (!is_array($global)) $global = [];
            $newGlobal = array_merge($global, $incoming);
            Setting::set('global_settings', $newGlobal);
            
            return response()->json([
                'status' => 'success',
                'message' => 'บันทึกแม่แบบเริ่มต้นส่วนกลางเรียบร้อยแล้ว',
                'target' => 'global'
            ]);
        }

        if (str_starts_with($target, 'activity:') || str_starts_with($target, 'act:')) {
            $actId = preg_replace('/^(activity:|act:)/i', '', $target);
            $act = Activity::find($actId) ?: Activity::whereRaw('LOWER(id) = ?', [strtolower($actId)])->first();
            if (!$act) {
                $act = (new ActivityController)->findOrCreateActivityRecord($actId);
            }
            if (!$act) {
                return response()->json(['status' => 'error', 'message' => 'ไม่พบกิจกรรมนี้']);
            }
            if (!empty($request->input('resetToDefault'))) {
                $act->update(['certificate_template' => null]);
                return response()->json(['status' => 'success', 'message' => 'รีเซ็ตแม่แบบของกิจกรรม "' . $act->name . '" เป็นค่าเริ่มต้นเรียบร้อยแล้ว']);
            }
            $act->update(['certificate_template' => $incoming]);
            return response()->json([
                'status' => 'success',
                'message' => 'บันทึกแม่แบบเฉพาะของกิจกรรม "' . $act->name . '" เรียบร้อยแล้ว',
                'target' => 'activity:' . $act->id
            ]);
        }

        $sourceId = str_replace('source:', '', $target);
        if (str_starts_with($target, 'base:')) {
            $baseId = str_replace('base:', '', $target);
            $base = Base::find($baseId);
            $sourceId = $base?->source_id ?: '';
        }

        $source = Source::find($sourceId);
        if (!$source) {
            return response()->json(['status' => 'error', 'message' => 'ไม่พบแหล่งเรียนรู้นี้']);
        }

        if (!empty($request->input('resetToDefault'))) {
            $source->update(['cert_template' => null]);
            return response()->json(['status' => 'success', 'message' => 'รีเซ็ตแม่แบบของแหล่งเรียนรู้ "' . $source->name . '" เป็นค่าเริ่มต้นเรียบร้อยแล้ว']);
        }

        $source->update(['cert_template' => $incoming]);
        return response()->json([
            'status' => 'success',
            'message' => 'บันทึกแม่แบบเฉพาะของแหล่งเรียนรู้ "' . $source->name . '" เรียบร้อยแล้ว',
            'target' => 'source:' . $source->id
        ]);
    }

    protected function imageToBase64($urlOrPath): string
    {
        if (empty($urlOrPath)) return '';
        if (str_starts_with($urlOrPath, 'data:')) return $urlOrPath;

        $localPath = $this->resolveLocalPath($urlOrPath);
        $filePath = '';
        if (str_starts_with($localPath, 'file:///')) {
            $filePath = substr($localPath, 8);
        } elseif (file_exists($localPath) && is_file($localPath)) {
            $filePath = $localPath;
        }

        if (!empty($filePath) && file_exists($filePath) && is_file($filePath)) {
            $data = @file_get_contents($filePath);
            if ($data !== false) {
                $ext = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
                $mime = ($ext === 'png') ? 'image/png' : (($ext === 'jpg' || $ext === 'jpeg') ? 'image/jpeg' : 'image/png');
                return 'data:' . $mime . ';base64,' . base64_encode($data);
            }
        }

        if (str_starts_with($urlOrPath, 'http://') || str_starts_with($urlOrPath, 'https://')) {
            $ctx = stream_context_create([
                'ssl' => ['verify_peer' => false, 'verify_peer_name' => false],
                'http' => ['timeout' => 5]
            ]);
            $data = @file_get_contents($urlOrPath, false, $ctx);
            if ($data !== false) {
                $ext = strtolower(pathinfo(parse_url($urlOrPath, PHP_URL_PATH) ?? '', PATHINFO_EXTENSION));
                $mime = ($ext === 'png') ? 'image/png' : (($ext === 'jpg' || $ext === 'jpeg') ? 'image/jpeg' : 'image/png');
                return 'data:' . $mime . ';base64,' . base64_encode($data);
            }
        }

        return '';
    }

    public function downloadCertificate(Request $request)
    {
        $certId = trim((string) ($request->input('certId') ?? $request->input('id') ?? ''));
        $sourceId = trim((string) ($request->input('sourceId') ?? ''));
        $baseId = trim((string) ($request->input('baseId') ?? ''));
        $activityId = trim((string) ($request->input('activityId') ?? ''));
        
        $actor = AuthService::buildActorFromRequest($request);
        $username = $actor['username'] ?? trim((string) ($request->input('username') ?? $request->input('phone') ?? ''));
        if (!$username) {
            $token = trim((string) ($request->input('token') ?? ''));
            if ($token) {
                $user = User::where('api_token', $token)->orWhere('remember_token', $token)->first();
                if ($user) $username = $user->username;
            }
        }

        $cert = null;
        if ($certId) {
            $cert = Certificate::find($certId);
        }
        if (!$cert && $username) {
            $certQuery = Certificate::where('username', $username);
            if ($sourceId) $certQuery->where('source_id', $sourceId);
            elseif ($activityId) $certQuery->where('activity_id', $activityId);
            elseif ($baseId) $certQuery->where('base_id', $baseId);
            $cert = $certQuery->orderByDesc('issued_at')->first();
        }

        if ($cert) {
            if (empty($sourceId)) $sourceId = (string) ($cert->source_id ?? '');
            if (empty($baseId)) $baseId = (string) ($cert->base_id ?? '');
            if (empty($activityId)) $activityId = (string) ($cert->activity_id ?? '');
            if (empty($username)) $username = $cert->username;
        }

        if ($username || $certId || $sourceId || $activityId) {
            $genRequest = new Request([
                'certId' => $certId,
                'sourceId' => $sourceId,
                'baseId' => $baseId,
                'activityId' => $activityId,
                'token' => $request->input('token'),
                'username' => $username,
                'existingCertNo' => $cert ? $cert->cert_no : null,
                'isTest' => 0,
            ]);
            $res = $this->generateCert($genRequest);
            $json = $res->getData(true);
            if (!empty($json['url'])) {
                $parsedPath = parse_url($json['url'], PHP_URL_PATH);
                $relPath = preg_replace('/^\/?storage\//', '', $parsedPath);
                if (Storage::disk('public')->exists($relPath)) {
                    return response()->file(Storage::disk('public')->path($relPath), [
                        'Content-Type' => 'application/pdf',
                        'Content-Disposition' => 'inline; filename="' . basename($relPath) . '"'
                    ]);
                }
                return redirect($json['url']);
            }
        }

        return response('ไม่พบข้อมูลใบประกาศนียบัตร หรือยังไม่ผ่านเกณฑ์การทดสอบ', 404);
    }

    public function generateCert(Request $request): JsonResponse
    {
        $isTest = !empty($request->input('isTest')) || filter_var($request->input('isTest'), FILTER_VALIDATE_BOOLEAN);

        $certId = trim((string) ($request->input('certId') ?? $request->input('id') ?? ''));
        $sourceId = trim((string) $request->input('sourceId', ''));
        $baseId = trim((string) $request->input('baseId', ''));
        $activityId = trim((string) $request->input('activityId', ''));

        if ($certId) {
            $existingCert = Certificate::find($certId);
            if ($existingCert) {
                if (empty($sourceId)) $sourceId = (string) ($existingCert->source_id ?? '');
                if (empty($baseId)) $baseId = (string) ($existingCert->base_id ?? '');
                if (empty($activityId)) $activityId = (string) ($existingCert->activity_id ?? '');
                if (empty($request->input('username')) && !empty($existingCert->username)) {
                    $request->merge(['username' => $existingCert->username]);
                }
            }
        }

        $actor = AuthService::buildActorFromRequest($request);
        $targetUser = trim((string) ($request->input('targetUsername') ?? $request->input('username') ?? $request->input('phone') ?? ''));
        
        $effectiveUsername = '';
        if ($actor && in_array($actor['role'] ?? '', ['admin', 'teacher']) && $targetUser) {
            $effectiveUsername = $targetUser;
        } elseif ($actor && !empty($actor['username'])) {
            $effectiveUsername = $actor['username'];
        } elseif ($targetUser) {
            $effectiveUsername = $targetUser;
        }

        if (!$effectiveUsername) {
            if ($isTest) {
                $effectiveUsername = 'admin';
                $actor = ['username' => 'admin', 'name' => 'ผู้ทดสอบระบบ', 'role' => 'admin'];
            } else {
                return response()->json(['status' => 'error', 'message' => 'กรุณาระบุผู้เรียนหรือเข้าสู่ระบบ'], 401);
            }
        }
        
        $user = User::where('username', $effectiveUsername)->first();
        $displayName = $user ? $user->full_name : ($user ? $user->username : ($actor['name'] ?? 'ผู้เรียน'));
        if ($isTest) {
            $displayName = $request->input('name') ?: 'นายสมชาย รักดี (ทดสอบระบบ)';
        }

        $source = null;
        $base = null;
        $activity = null;
        $quizLog = null;
        $subjectName = '';
        $scoreStr = '100%';
        $template = null;

        $instId = 'INS_PHRAO';
        if ($user && !empty($user->institution_id)) {
            $instId = $user->institution_id;
        } elseif ($actor && !empty($actor['institution_id'])) {
            $instId = $actor['institution_id'];
        }

        $attendanceType = 'onsite';
        if (!empty($activityId)) {
            $activity = Activity::find($activityId);
            if (!$activity && !$isTest) return response()->json(['status' => 'error', 'message' => 'ไม่พบกิจกรรม']);
            if ($activity && !empty($activity->institution_id)) {
                $instId = $activity->institution_id;
            }
            
            if (!$isTest) {
                $userObj = User::where('username', $effectiveUsername)->orWhere('phone', $effectiveUsername)->first();
                $usernames = array_unique(array_filter([$effectiveUsername, $userObj?->username, $userObj?->phone]));

                $checkIn = ActivityCheckIn::whereIn('username', $usernames)->where('activity_id', $activityId)->first();
                $quizPassed = QuizLog::whereIn('username', $usernames)->where('activity_id', $activityId)->where('status', 'Pass')->exists();
                $certExists = Certificate::whereIn('username', $usernames)->where('activity_id', $activityId)->where('status', 'Active')->first();

                if (!$checkIn && !$quizPassed && !$certExists && ($actor['role'] ?? '') !== 'admin') {
                    return response()->json(['status' => 'error', 'message' => 'ยังไม่ได้เช็คอินเข้าร่วมกิจกรรม หรือยังไม่ผ่านเกณฑ์การทดสอบ']);
                }

                if ($certExists && !empty($certExists->attendance_type)) {
                    $attendanceType = $certExists->attendance_type;
                } else {
                    $attendanceType = $checkIn ? 'onsite' : 'online';
                }
            }
            
            $subjectName = $activity ? $activity->name : ($request->input('source') ?: 'กิจกรรมทดสอบ');
            $template = $activity ? $activity->certificate_template : null;
            if (is_string($template)) {
                $template = json_decode($template, true);
            }
            
            $scoreStr = 'ผ่านการประเมิน';
        } else {
            if (!$isTest) {
                $userObj = User::where('username', $effectiveUsername)->orWhere('phone', $effectiveUsername)->first();
                $usernames = array_unique(array_filter([$effectiveUsername, $userObj?->username, $userObj?->phone]));

                $quizLog = QuizLog::whereIn('username', $usernames)
                    ->where('source_id', $sourceId)
                    ->where('status', 'Pass')
                    ->orderByDesc('score')
                    ->first();

                if (!$quizLog && !empty($baseId)) {
                    $quizLog = QuizLog::whereIn('username', $usernames)
                        ->where('base_id', $baseId)
                        ->where('status', 'Pass')
                        ->orderByDesc('score')
                        ->first();
                }

                // If existing certificate record exists in DB, allow generation
                if (!$quizLog) {
                    $cRecord = null;
                    if ($certId) {
                        $cRecord = Certificate::find($certId);
                    }
                    if (!$cRecord) {
                        $cRecord = Certificate::whereIn('username', $usernames)
                            ->where('source_id', $sourceId)
                            ->where('status', 'Active')
                            ->first();
                    }
                    if (!$cRecord && ($actor['role'] ?? '') !== 'admin') {
                        return response()->json(['status' => 'error', 'message' => 'ยังไม่พบผลสอบผ่านสำหรับใบประกาศนี้']);
                    }
                }
            }

            $source = $sourceId ? Source::find($sourceId) : null;
            if (!$source && $baseId) {
                $base = Base::find($baseId);
                if ($base && $base->source_id) {
                    $sourceId = $base->source_id;
                    $source = Source::find($sourceId);
                }
            }
            $subjectName = ($isTest && $request->input('source')) ? $request->input('source') : ($source?->name ?: ($request->input('source') ?: 'แหล่งเรียนรู้'));
            
            $template = $source?->cert_template;
            if (is_string($template)) {
                $template = json_decode($template, true);
            }

            if ($source && !empty($source->institution_id)) {
                $instId = $source->institution_id;
            }
        }

        if ($instId === 'ALL' || !$instId) $instId = 'INS_PHRAO';

        // Load Global & Institution settings
        $globalSettings = Setting::get('global_settings', []);
        if (!is_array($globalSettings)) $globalSettings = [];

        $instSettings = Setting::get("settings_{$instId}", []);
        if (is_array($instSettings) && !empty($instSettings)) {
            $globalSettings = array_merge($globalSettings, $instSettings);
        }

        $defaultConfig = [
            'backgroundUrl' => '',
            'certHeader' => 'ศูนย์ส่งเสริมการเรียนรู้ระดับอำเภอพร้าว',
            'certHeaderFontSize' => 42,
            'certHeaderColor' => '#064e3b',
            'certHeaderMarginTop' => 154,
            'certHeaderSub' => 'กรมส่งเสริมการเรียนรู้ กระทรวงศึกษาธิการ',
            'certHeaderSubFontSize' => 23,
            'certHeaderSubColor' => '#475569',
            'certHeaderSubMarginTop' => 19,
            'certSubtitle' => 'ขอมอบไว้เพื่อแสดงว่า',
            'certSubtitleFontSize' => 20,
            'certSubtitleColor' => '#334155',
            'certSubtitleMarginTop' => 19,
            'certNameFontSize' => 33,
            'certNameColor' => '#064e3b',
            'certNameMarginTop' => -10,
            'certDesc' => 'ได้ผ่านการประเมินความรู้ตามเกณฑ์การเรียนรู้เรื่อง',
            'certDescFontSize' => 20,
            'certDescColor' => '#334155',
            'certDescMarginTop' => 18,
            'certSubjectFontSize' => 25,
            'certSubjectColor' => '#064e3b',
            'certSubjectMarginTop' => 12,
            'certDatePrefix' => 'ให้ไว้ ณ วันที่',
            'certDateFontSize' => 19,
            'certDateColor' => '#334155',
            'certDateMarginTop' => 19,
            'directorName' => 'นายประวิตร ประธรรมโย',
            'directorTitle' => 'ผู้อำนวยการ สกร.ระดับอำเภอพร้าว',
            'certSigFontSize' => 16,
            'certSigColor' => '#0f172a',
            'certSigMarginTop' => -21
        ];

        $effectiveTemplate = array_merge($defaultConfig, $globalSettings);
        if (!empty($template) && is_array($template)) {
            $effectiveTemplate = array_merge($effectiveTemplate, $template);
        }

        // In test mode, allow passing live template
        if ($isTest) {
            $incomingTemplate = $request->input('template');
            if (is_string($incomingTemplate)) {
                $incomingTemplate = json_decode($incomingTemplate, true);
            }
            if (!empty($incomingTemplate) && is_array($incomingTemplate)) {
                $effectiveTemplate = array_merge($effectiveTemplate, $incomingTemplate);
            }
        }

        $existingCertNo = $request->input('existingCertNo');
        $certNo = $existingCertNo ?: ('CERT-'.now()->format('Ymd').'-'.strtoupper(Str::random(8)));
        $safeName = preg_replace('/[^A-Za-z0-9_-]/', '_', $effectiveUsername ?: 'user');
        $path = 'certificates/'.now()->format('Y/m').'/'.$safeName.'-'.$certNo.'.pdf';

        $thaiMonths = [
            1 => 'มกราคม', 2 => 'กุมภาพันธ์', 3 => 'มีนาคม', 4 => 'เมษายน',
            5 => 'พฤษภาคม', 6 => 'มิถุนายน', 7 => 'กรกฎาคม', 8 => 'สิงหาคม',
            9 => 'กันยายน', 10 => 'ตุลาคม', 11 => 'พฤศจิกายน', 12 => 'ธันวาคม'
        ];
        $now = now();
        $dateStr = $now->format('j') . ' ' . ($thaiMonths[(int)$now->format('n')] ?? '') . ' พ.ศ. ' . ((int)$now->format('Y') + 543);

        $fontPath = str_replace('\\', '/', public_path('fonts/THSarabun.ttf'));
        $fontBoldPath = str_replace('\\', '/', public_path('fonts/THSarabunNew-Bold.ttf'));
        $fontCss = '@font-face { font-family: \'THSarabun\'; src: url("file:///' . $fontPath . '") format("truetype"); font-weight: normal; font-style: normal; } '
                 . '@font-face { font-family: \'THSarabun\'; src: url("file:///' . $fontBoldPath . '") format("truetype"); font-weight: bold; font-style: normal; } '
                 . '@font-face { font-family: \'THSarabunNew\'; src: url("file:///' . $fontPath . '") format("truetype"); font-weight: normal; font-style: normal; } '
                 . '@font-face { font-family: \'THSarabunNew\'; src: url("file:///' . $fontBoldPath . '") format("truetype"); font-weight: bold; font-style: normal; } ';

        $bgUrl = $effectiveTemplate['backgroundUrl'] ?? ($effectiveTemplate['certificateTemplate'] ?? ($effectiveTemplate['globalCertTemplate'] ?? ''));
        $bgImgSrc = $this->imageToBase64($bgUrl);

        // Row 1: ชื่อหน่วยงาน / สถาบัน
        $certHeader = $effectiveTemplate['certHeader'] ?? 'ศูนย์ส่งเสริมการเรียนรู้ระดับอำเภอพร้าว';
        $headerFontSize = round(intval($effectiveTemplate['certHeaderFontSize'] ?? 42) * 0.1 * 8.4189, 1);
        $headerColor = $effectiveTemplate['certHeaderColor'] ?? '#064e3b';
        $headerMarginTop = intval($effectiveTemplate['certHeaderMarginTop'] ?? 154);
        $headerTopMarginPt = round($headerMarginTop * 0.1 * 8.4189, 1);

        // Row 2: สังกัด
        $certHeaderSub = $effectiveTemplate['certHeaderSub'] ?? 'กรมส่งเสริมการเรียนรู้ กระทรวงศึกษาธิการ';
        $headerSubFontSize = round(intval($effectiveTemplate['certHeaderSubFontSize'] ?? 23) * 0.1 * 8.4189, 1);
        $headerSubColor = $effectiveTemplate['certHeaderSubColor'] ?? '#475569';
        $headerSubMarginTop = intval($effectiveTemplate['certHeaderSubMarginTop'] ?? 19);
        $headerSubTopMarginPt = round($headerSubMarginTop * 0.1 * 8.4189, 1);

        // Row 3: ข้อความเกริ่นนำ
        $certSubtitle = $effectiveTemplate['certSubtitle'] ?? 'ขอมอบไว้เพื่อแสดงว่า';
        $subtitleFontSize = round(intval($effectiveTemplate['certSubtitleFontSize'] ?? 20) * 0.1 * 8.4189, 1);
        $subtitleColor = $effectiveTemplate['certSubtitleColor'] ?? '#334155';
        $subtitleMarginTop = intval($effectiveTemplate['certSubtitleMarginTop'] ?? 19);
        $subtitleTopMarginPt = round($subtitleMarginTop * 0.1 * 8.4189, 1);

        // Row 4: ชื่อผู้รับ
        $nameFontSize = round(intval($effectiveTemplate['certNameFontSize'] ?? 33) * 0.1 * 8.4189, 1);
        $nameColor = $effectiveTemplate['certNameColor'] ?? '#064e3b';
        $nameMarginTop = intval($effectiveTemplate['certNameMarginTop'] ?? -10);
        $nameTopMarginPt = round($nameMarginTop * 0.1 * 8.4189, 1);

        // Row 5: ข้อความเกริ่นหลักสูตร
        $certDesc = $effectiveTemplate['certDesc'] ?? 'ได้ผ่านการประเมินความรู้ตามเกณฑ์การเรียนรู้เรื่อง';
        $descFontSize = round(intval($effectiveTemplate['certDescFontSize'] ?? 20) * 0.1 * 8.4189, 1);
        $descColor = $effectiveTemplate['certDescColor'] ?? '#334155';
        $descMarginTop = intval($effectiveTemplate['certDescMarginTop'] ?? 18);
        $descTopMarginPt = round($descMarginTop * 0.1 * 8.4189, 1);

        // Row 6: ชื่อหลักสูตร / เรื่อง
        $subjectFontSize = round(intval($effectiveTemplate['certSubjectFontSize'] ?? 25) * 0.1 * 8.4189, 1);
        $subjectColor = $effectiveTemplate['certSubjectColor'] ?? '#064e3b';
        $subjectMarginTop = intval($effectiveTemplate['certSubjectMarginTop'] ?? 12);
        $subjectTopMarginPt = round($subjectMarginTop * 0.1 * 8.4189, 1);

        // Row 7: แถบคะแนน & วันที่
        $datePrefix = $effectiveTemplate['certDatePrefix'] ?? 'ให้ไว้ ณ วันที่';
        $dateFontSize = round(intval($effectiveTemplate['certDateFontSize'] ?? 19) * 0.1 * 8.4189, 1);
        $dateColor = $effectiveTemplate['certDateColor'] ?? '#334155';
        $dateMarginTop = intval($effectiveTemplate['certDateMarginTop'] ?? 19);
        $dateTopMarginPt = round($dateMarginTop * 0.1 * 8.4189, 1);

        // Row 8: ผู้ลงนาม & ลายเซ็น
        $directorName = $effectiveTemplate['directorName'] ?? 'นายประวิตร ประธรรมโย';
        $defaultDirectorTitle = ($instId === 'INS_MAERIM')
            ? 'ผู้อำนวยการศูนย์ส่งเสริมการเรียนรู้ระดับอำเภอแม่ริม'
            : 'ผู้อำนวยการศูนย์ส่งเสริมการเรียนรู้ระดับอำเภอพร้าว';
        $directorTitle = $effectiveTemplate['directorTitle'] ?? $defaultDirectorTitle;
        $sigFontSize = intval($effectiveTemplate['certSigFontSize'] ?? 16);
        $sigDirectorNameFontSize = round($sigFontSize * 0.13 * 8.4189, 1);
        $sigDirectorTitleFontSize = round($sigFontSize * 0.095 * 8.4189, 1);
        $sigColor = $effectiveTemplate['certSigColor'] ?? '#0f172a';
        $sigMarginTop = intval($effectiveTemplate['certSigMarginTop'] ?? -21);
        $sigTopMarginPt = round($sigMarginTop * 0.1 * 8.4189, 1);

        // Signature image guarantee
        $sigUrl = $effectiveTemplate['signatureUrl'] ?? ($globalSettings['signatureUrl'] ?? '');
        if (empty($sigUrl)) {
            $rawGlobal = Setting::get('global_settings', []);
            $sigUrl = $rawGlobal['signatureUrl'] ?? '';
        }
        $sigImgSrc = $this->imageToBase64($sigUrl);

        $sigImgHtml = '';
        if (!empty($sigImgSrc)) {
            $sigImgHtml = '<img src="' . $sigImgSrc . '" style="height: 68pt; width: auto; max-width: 230pt; margin: 0 auto 0 auto; display: block;">';
        } else {
            $sigImgHtml = '<svg viewBox="0 0 150 36" style="height: 32pt; width: 110pt; margin: 0 auto 1pt auto; display: block;" fill="none" stroke="#0f172a" stroke-width="2"><path d="M 10 26 Q 30 5, 50 20 T 90 16 T 135 26" /></svg>';
        }

        $html = '<!doctype html><html lang="th"><head><meta charset="utf-8"><style>'
            . $fontCss
            . '@page { size: 297mm 210mm; margin: 0; } '
            . '* { box-sizing: border-box; margin: 0; padding: 0; } '
            . 'html, body { margin: 0; padding: 0; width: 841.89pt; height: 595.28pt; background: #ffffff; font-family: "THSarabun", "THSarabunNew", "Sarabun", sans-serif; overflow: hidden; text-align: center; } '
            . '.cert-container { position: absolute; top: 0; left: 0; width: 841.89pt; height: 595.28pt; overflow: hidden; } '
            . '.cert-bg-img { position: absolute; top: 0; left: 0; width: 841.89pt; height: 595.28pt; z-index: 1; } '
            . '.cert-layout-table { position: absolute; top: 0; left: 0; width: 841.89pt; height: 480pt; border-collapse: collapse; border: 0; margin: 0; padding: 0; table-layout: fixed; z-index: 2; } '
            . '.td-top { vertical-align: top; text-align: center; padding: 0 45pt; } '
            . '.td-mid { vertical-align: middle; text-align: center; padding: 0 45pt; } '
            . '.td-bot { vertical-align: top; text-align: center; padding: 0 45pt 0 45pt; } '
            . '.cert-header { font-size: ' . $headerFontSize . 'pt; font-weight: bold; color: ' . $headerColor . '; margin-top: ' . $headerTopMarginPt . 'pt; line-height: 1.15; } '
            . '.cert-header-sub { font-size: ' . $headerSubFontSize . 'pt; font-weight: bold; color: ' . $headerSubColor . '; margin-top: ' . $headerSubTopMarginPt . 'pt; line-height: 1.15; } '
            . '.cert-subtitle { font-size: ' . $subtitleFontSize . 'pt; font-weight: bold; color: ' . $subtitleColor . '; margin-top: ' . $subtitleTopMarginPt . 'pt; margin-bottom: 2pt; line-height: 1.15; } '
            . '.cert-name { font-size: ' . $nameFontSize . 'pt; font-weight: bold; color: ' . $nameColor . '; margin-top: ' . $nameTopMarginPt . 'pt; line-height: 1.15; } '
            . '.cert-desc { font-size: ' . $descFontSize . 'pt; font-weight: bold; color: ' . $descColor . '; margin-top: ' . $descTopMarginPt . 'pt; margin-bottom: 2pt; line-height: 1.15; } '
            . '.cert-subject { font-size: ' . $subjectFontSize . 'pt; font-weight: bold; color: ' . $subjectColor . '; margin-top: ' . $subjectTopMarginPt . 'pt; line-height: 1.15; } '
            . '.cert-date { font-size: ' . $dateFontSize . 'pt; font-weight: bold; color: ' . $dateColor . '; margin-top: ' . $dateTopMarginPt . 'pt; margin-bottom: 0pt; line-height: 1.15; } '
            . '.cert-sig-block { text-align: center; width: 440pt; margin: 0 auto; } '
            . '.cert-director-name { font-size: ' . $sigDirectorNameFontSize . 'pt; font-weight: bold; color: ' . $sigColor . '; line-height: 1.15; margin-top: -4pt; } '
            . '.cert-director-title { font-size: ' . $sigDirectorTitleFontSize . 'pt; font-weight: bold; color: #475569; margin-top: 1pt; line-height: 1.15; } '
            . '.cert-footer-ref { position: absolute; left: 36pt; bottom: 22pt; font-size: 10pt; color: #64748b; font-family: "THSarabun", "THSarabunNew", sans-serif; text-align: left; z-index: 99; } '
            . '</style></head><body>'
            . '<div class="cert-container">'
            . (!empty($bgImgSrc) ? '<img src="' . $bgImgSrc . '" class="cert-bg-img" />' : '')
            . '<table class="cert-layout-table">'
            . '<tr><td class="td-top">'
            . '<div class="cert-header">' . e($certHeader) . '</div>'
            . '<div class="cert-header-sub">' . e($certHeaderSub) . '</div>'
            . '<div class="cert-subtitle">' . e($certSubtitle) . '</div>'
            . '</td></tr>'
            . '<tr><td class="td-mid">'
            . '<div class="cert-name">' . e($displayName) . '</div>'
            . '<div class="cert-desc">' . e($certDesc) . '</div>'
            . '<div class="cert-subject">' . e($subjectName) . '</div>'
            . '<div class="cert-date">' . e($datePrefix) . ' ' . e($dateStr) . '</div>'
            . '</td></tr>'
            . '<tr><td class="td-bot">'
            . '<div class="cert-sig-block" style="margin-top: ' . $sigTopMarginPt . 'pt;">'
            . $sigImgHtml
            . '<div class="cert-director-name">' . e($directorName) . '</div>'
            . '<div class="cert-director-title">' . e($directorTitle) . '</div>'
            . '</div>'
            . '</td></tr>'
            . '</table>'
            . '<div class="cert-footer-ref">เลขที่อ้างอิง: ' . e($certNo) . (!empty($activityId) ? ($attendanceType === 'online' ? ' | รูปแบบ: ศึกษาเรียนรู้ด้วยตนเองผ่านระบบออนไลน์ (Online Self-paced)' : ' | รูปแบบ: เข้าร่วมกิจกรรม ณ สถานที่จริง (On-site)') : '') . '</div>'
            . '</div></body></html>';

        $html = $this->liftThaiToneMarks($html);

        $pdf = Pdf::loadHTML($html)->setPaper('a4', 'landscape');
        Storage::disk('public')->put($path, $pdf->output());
        $url = asset('storage/' . $path);

        if (!$isTest && $effectiveUsername) {
            Certificate::updateOrCreate(
                ['username' => $effectiveUsername, 'source_id' => $sourceId ?: null, 'activity_id' => $activityId ?: null],
                ['cert_url' => $url, 'cert_no' => $certNo, 'status' => 'Active', 'issued_at' => now(), 'revoked_at' => null, 'revoked_by' => null]
            );
            
            if (!empty($quizLog)) {
                $quizLog->update(['cert_url' => $url]);
            }
        }

        return response()->json(['status' => 'success', 'url' => $url, 'certNo' => $certNo]);
    }

    public function revokeCert(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor) return response()->json(['status' => 'error', 'message' => 'กรุณาเข้าสู่ระบบ'], 401);

        $cert = $request->filled('certId')
            ? Certificate::find($request->input('certId'))
            : Certificate::where('username', $actor['username'])
                ->where('source_id', $request->input('sourceId') ?: null)
                ->where('base_id', $request->input('baseId') ?: null)
                ->where('activity_id', $request->input('activityId') ?: null)
                ->first();
        if (!$cert) return response()->json(['status' => 'error', 'message' => 'ไม่พบใบประกาศ']);
        if ($actor['role'] !== 'admin' && $cert->username !== $actor['username']) {
            return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์'], 403);
        }

        $cert->update([
            'status'     => 'Revoked',
            'revoked_at' => now(),
            'revoked_by' => $actor['username'],
        ]);

        return response()->json(['status' => 'success']);
    }

    public function getUserCertificates(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        $username = $actor['username'] ?? '';

        if (!$username) {
            $rawUser = trim((string) ($request->input('username') ?? $request->input('phone') ?? $request->input('auth_phone') ?? ''));
            if ($rawUser) {
                $user = User::where('username', $rawUser)->orWhere('phone', $rawUser)->first();
                if ($user) {
                    $username = $user->username;
                } else {
                    $username = $rawUser;
                }
            }
        }

        if (!$username) {
            return response()->json(['status' => 'error', 'message' => 'กรุณาเข้าสู่ระบบ'], 401);
        }

        $userObj = User::where('username', $username)->orWhere('phone', $username)->first();
        $usernames = array_unique(array_filter([$username, $userObj?->username, $userObj?->phone]));

        // Auto-sync 1 Certificate per Source for passed quizzes
        $passedSourceIds = QuizLog::whereIn('username', $usernames)
            ->where('status', 'Pass')
            ->whereNotNull('source_id')
            ->where('source_id', '!=', '')
            ->pluck('source_id')
            ->unique()
            ->filter();

        if ($passedSourceIds->isNotEmpty()) {
            $existingCertSourceIds = Certificate::whereIn('username', $usernames)
                ->whereIn('source_id', $passedSourceIds)
                ->pluck('source_id')
                ->toArray();

            $missingSourceIds = array_diff($passedSourceIds->toArray(), $existingCertSourceIds);
            foreach ($missingSourceIds as $sId) {
                Certificate::create([
                    'username'  => $username,
                    'source_id' => $sId,
                    'base_id'   => null,
                    'cert_no'   => 'CERT-' . strtoupper(Str::random(8)),
                    'issued_at' => now(),
                    'status'    => 'Active',
                ]);
            }
        }

        $data = Certificate::whereIn('username', $usernames)
            ->where('status', 'Active')
            ->orderByDesc('issued_at')
            ->get()
            ->unique(function ($c) {
                return !empty($c->activity_id) ? ('act_' . $c->activity_id) : ('src_' . $c->source_id);
            })
            ->values()
            ->map(function ($c) use ($username) {
                $sourceName = '';
                $score = '100%';
                $tambon = '';
                $institutionId = 'INS_PHRAO';
                $type = 'แหล่งเรียนรู้';

                if (!empty($c->source_id)) {
                    $src = Source::where('id', $c->source_id)->first();
                    $sourceName = $src ? $src->name : '';
                    $tambon = $src ? ($src->tambon ?? '') : '';
                    $institutionId = $src ? ($src->institution_id ?? 'INS_PHRAO') : 'INS_PHRAO';
                    $type = 'แหล่งเรียนรู้ (ม.6)';

                    $log = QuizLog::where('username', $username)
                        ->where('source_id', $c->source_id)
                        ->orderByDesc('created_at')
                        ->first();
                    if ($log) {
                        $score = number_format((float) $log->score, 0) . '%';
                    }
                } elseif (!empty($c->base_id)) {
                    $base = Base::where('id', $c->base_id)->first();
                    $sourceName = $base ? $base->name : '';
                    $type = 'ฐานเรียนรู้';
                    $log = QuizLog::where('username', $username)
                        ->where('base_id', $c->base_id)
                        ->orderByDesc('created_at')
                        ->first();
                    if ($log) {
                        $score = number_format((float) $log->score, 0) . '%';
                    }
                } elseif (!empty($c->activity_id)) {
                    $activity = Activity::find($c->activity_id);
                    $sourceName = $activity ? $activity->name : '';
                    $tambon = $activity ? ($activity->tambon ?? '') : '';
                    $institutionId = $activity ? ($activity->institution_id ?? 'INS_PHRAO') : 'INS_PHRAO';
                    $score = 'ผ่านการประเมิน';
                    $type = ($c->attendance_type === 'online') 
                        ? 'กิจกรรมการเรียนรู้ออนไลน์ (Self-paced)' 
                        : 'กิจกรรมการเรียนรู้ On-site';
                }

                $instName = ($institutionId === 'INS_MAERIM') ? 'สกร.ระดับอำเภอแม่ริม' : 'สกร.ระดับอำเภอพร้าว';
                $finalTitle = $sourceName ?: 'หลักสูตรแหล่งเรียนรู้ชุมชน';
                $issuedFormatted = $c->issued_at ? $c->issued_at->format('d/m/Y') : now()->format('d/m/Y');
                $issuedFull = $c->issued_at ? $c->issued_at->format('d/m/Y H:i น.') : now()->format('d/m/Y H:i น.');

                return [
                    'id'             => $c->id,
                    'certNo'         => $c->cert_no,
                    'cert_no'        => $c->cert_no,
                    'certUrl'        => $c->cert_url,
                    'cert_url'       => $c->cert_url,
                    'sourceId'       => $c->source_id,
                    'source_id'      => $c->source_id,
                    'baseId'         => $c->base_id,
                    'base_id'        => $c->base_id,
                    'activityId'     => $c->activity_id,
                    'activity_id'    => $c->activity_id,
                    'attendanceType' => $c->attendance_type ?? 'onsite',
                    'attendance_type'=> $c->attendance_type ?? 'onsite',
                    'sourceName'     => $finalTitle,
                    'source_name'    => $finalTitle,
                    'title'          => $finalTitle,
                    'name'           => $finalTitle,
                    'tambon'         => $tambon,
                    'institution'    => $instName,
                    'institutionId'  => $institutionId,
                    'score'          => $score,
                    'score_text'     => $score,
                    'issuedAt'       => $issuedFormatted,
                    'issued_at'      => $issuedFormatted,
                    'issuedAtFull'   => $issuedFull,
                    'issue_date'     => $issuedFormatted,
                    'type'           => $type,
                    'status'         => $c->status ?? 'Active',
                ];
            });

        return response()->json(['status' => 'success', 'data' => $data, 'certificates' => $data, 'history' => $data]);
    }

    public function getCertIssuanceHistory(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor || !in_array($actor['role'], ['admin', 'teacher'])) {
            return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์']);
        }

        // Auto-sync 1 Certificate per Source/Activity for all users who passed quizzes/check-ins
        $passedLogs = QuizLog::where('status', 'Pass')
            ->whereNotNull('source_id')
            ->where('source_id', '!=', '')
            ->get();

        foreach ($passedLogs as $log) {
            $exists = Certificate::where('username', $log->username)
                ->where('source_id', $log->source_id)
                ->exists();

            if (!$exists) {
                Certificate::create([
                    'username'  => $log->username,
                    'source_id' => $log->source_id,
                    'base_id'   => $log->base_id ?? null,
                    'cert_no'   => 'CERT-' . strtoupper(Str::random(8)),
                    'issued_at' => $log->updated_at ?? now(),
                    'status'    => 'Active',
                ]);
            }
        }

        $query = Certificate::with(['user' => fn($q) => $q->select('username', 'full_name', 'tambon', 'institution_id')])
            ->orderByDesc('issued_at');

        $instId = trim($request->input('institutionId') ?? $request->input('institution_id') ?? '');
        if (!$instId && $actor['institution_id'] !== 'ALL') {
            $instId = $actor['institution_id'];
        }
        if ($instId && $instId !== 'ALL' && $instId !== 'ทั้งหมด') {
            $query->whereHas('user', fn ($q) => $q->where('institution_id', $instId));
        }

        if ($actor['role'] === 'teacher') {
            $rawTambon = $actor['tambon'];
            $clean = AuthService::normalizeTambon($rawTambon);
            $query->whereHas('user', function($q) use ($rawTambon, $clean) {
                $q->where('tambon', $rawTambon);
                if ($clean !== '' && $clean !== 'all') {
                    $q->orWhere('tambon', 'LIKE', '%' . $clean . '%');
                }
            });
        } else {
            $inputTambon = trim((string) ($request->input('tambon') ?? ''));
            $clean = AuthService::normalizeTambon($inputTambon);
            if ($inputTambon && !in_array($inputTambon, ['all', 'ทั้งหมด'], true) && $clean !== 'all' && $clean !== '') {
                $query->whereHas('user', function($q) use ($inputTambon, $clean) {
                    $q->where('tambon', $inputTambon)
                      ->orWhere('tambon', 'LIKE', '%' . $clean . '%');
                });
            }
        }

        $allSources = Source::pluck('name', 'id')->toArray();
        $allBases   = Base::pluck('name', 'id')->toArray();
        $allActs    = Activity::pluck('name', 'id')->toArray();

        $data = $query->limit(500)
            ->get()
            ->map(function ($c) use ($allSources, $allBases, $allActs) {
                $sourceName = '';
                $score = 'ผ่านการประเมิน';

                if (!empty($c->activity_id) && isset($allActs[$c->activity_id])) {
                    $sourceName = $allActs[$c->activity_id];
                    $score = 'ผ่านการประเมิน';
                } elseif (!empty($c->source_id)) {
                    if (isset($allSources[$c->source_id])) {
                        $sourceName = $allSources[$c->source_id];
                    }
                    $log = QuizLog::where('username', $c->username)
                        ->where('source_id', $c->source_id)
                        ->orderByDesc('created_at')
                        ->first();
                    if ($log && $log->score !== null) {
                        $score = is_numeric($log->score) ? (number_format((float) $log->score, 0) . '%') : (string) $log->score;
                    }
                } elseif (!empty($c->base_id)) {
                    if (isset($allBases[$c->base_id])) {
                        $sourceName = $allBases[$c->base_id];
                    }
                    $log = QuizLog::where('username', $c->username)
                        ->where('base_id', $c->base_id)
                        ->orderByDesc('created_at')
                        ->first();
                    if ($log && $log->score !== null) {
                        $score = is_numeric($log->score) ? (number_format((float) $log->score, 0) . '%') : (string) $log->score;
                    }
                }

                if (!$sourceName) {
                    $sourceName = 'ใบประกาศเกียรติบัตรการเรียนรู้';
                }

                $certNo = $c->cert_no ?: ('CERT-' . str_pad($c->id, 6, '0', STR_PAD_LEFT));
                $issuedFormatted = $c->issued_at?->format('d/m/Y') ?? $c->created_at?->format('d/m/Y') ?? now()->format('d/m/Y');

                return [
                    'id'          => $c->id,
                    'certId'      => $c->id,
                    'username'    => $c->username,
                    'userId'      => $c->username,
                    'fullName'    => $c->user?->full_name ?? $c->username,
                    'name'        => $c->user?->full_name ?? $c->username,
                    'tambon'      => $c->user?->tambon ?? '',
                    'sourceId'    => $c->source_id ?? '',
                    'baseId'      => $c->base_id ?? '',
                    'activityId'  => $c->activity_id ?? '',
                    'sourceName'  => $sourceName,
                    'source_name' => $sourceName,
                    'score'       => $score,
                    'certNo'      => $certNo,
                    'refNo'       => $certNo,
                    'ref_no'      => $certNo,
                    'certUrl'     => $c->cert_url,
                    'cert_url'    => $c->cert_url,
                    'status'      => $c->status,
                    'issuedAt'    => $issuedFormatted,
                    'issued_at'   => $issuedFormatted,
                    'date'        => $issuedFormatted,
                ];
            });

        return response()->json([
            'status' => 'success',
            'data'   => $data,
            'items'  => $data,
        ]);
    }

    /** getCertificateRegistry — ทะเบียนคุมการออกใบเกียรติบัตรพร้อมเลขที่อ้างอิง */
    public function getCertificateRegistry(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor || !in_array($actor['role'], ['admin', 'teacher'])) {
            return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์เข้าถึง']);
        }

        // Auto-sync certificates for all quiz passers if missing
        $passedLogs = QuizLog::where('status', 'Pass')
            ->whereNotNull('source_id')
            ->where('source_id', '!=', '')
            ->get();

        foreach ($passedLogs as $log) {
            $exists = Certificate::where('username', $log->username)
                ->where('source_id', $log->source_id)
                ->exists();

            if (!$exists) {
                $yearThai = (int) date('Y') + 543;
                $seq = Certificate::count() + 1;
                $refNo = 'สกร.พร้าว/' . $yearThai . '-' . str_pad($seq, 4, '0', STR_PAD_LEFT);
                Certificate::create([
                    'username'  => $log->username,
                    'source_id' => $log->source_id,
                    'base_id'   => $log->base_id ?? null,
                    'cert_no'   => $refNo,
                    'issued_at' => $log->updated_at ?? now(),
                    'status'    => 'Active',
                ]);
            }
        }

        $query = Certificate::with(['user' => fn($q) => $q->select('username', 'full_name', 'phone', 'tambon', 'institution_id')])
            ->orderByDesc('issued_at');

        // Institution Filter
        $instId = trim((string) ($request->input('institutionId') ?? $request->input('institution_id') ?? ''));
        if (!$instId && $actor['institution_id'] !== 'ALL') {
            $instId = $actor['institution_id'];
        }
        if ($instId && $instId !== 'ALL' && $instId !== 'ทั้งหมด') {
            $query->whereHas('user', fn ($q) => $q->where('institution_id', $instId));
        }

        // Tambon Filter
        if ($actor['role'] === 'teacher') {
            $rawTambon = $actor['tambon'];
            $clean = AuthService::normalizeTambon($rawTambon);
            $query->whereHas('user', function($q) use ($rawTambon, $clean) {
                $q->where('tambon', $rawTambon);
                if ($clean !== '' && $clean !== 'all') {
                    $q->orWhere('tambon', 'LIKE', '%' . $clean . '%');
                }
            });
        } else {
            $inputTambon = trim((string) ($request->input('tambon') ?? ''));
            $clean = AuthService::normalizeTambon($inputTambon);
            if ($inputTambon && !in_array($inputTambon, ['all', 'ALL', 'ทั้งหมด'], true) && $clean !== 'all' && $clean !== '') {
                $query->whereHas('user', function($q) use ($inputTambon, $clean) {
                    $q->where('tambon', $inputTambon)
                      ->orWhere('tambon', 'LIKE', '%' . $clean . '%');
                });
            }
        }

        // Source Filter
        $sourceId = trim((string) ($request->input('sourceId') ?? ''));
        if ($sourceId && $sourceId !== 'ALL' && $sourceId !== 'ทั้งหมด') {
            $query->where('source_id', $sourceId);
        }

        // Date Range Filter
        $dateFrom = trim((string) ($request->input('dateFrom') ?? ''));
        $dateTo   = trim((string) ($request->input('dateTo') ?? ''));
        if ($dateFrom) {
            $query->whereDate('issued_at', '>=', $dateFrom);
        }
        if ($dateTo) {
            $query->whereDate('issued_at', '<=', $dateTo);
        }

        // Search Filter
        $search = trim((string) ($request->input('search') ?? ''));
        if ($search) {
            $query->where(function($q) use ($search) {
                $q->where('cert_no', 'LIKE', "%{$search}%")
                  ->orWhere('username', 'LIKE', "%{$search}%")
                  ->orWhereHas('user', function($uq) use ($search) {
                      $uq->where('full_name', 'LIKE', "%{$search}%")
                         ->orWhere('phone', 'LIKE', "%{$search}%");
                  });
            });
        }

        $allSources = Source::pluck('name', 'id')->toArray();
        $allBases   = Base::pluck('name', 'id')->toArray();
        $allActs    = Activity::pluck('name', 'id')->toArray();

        $rawList = $query->get();
        $tambonCounts = [];
        $sourceCounts = [];
        $uniqueUsers = [];

        $items = $rawList->map(function ($c, $idx) use ($allSources, $allBases, $allActs, &$tambonCounts, &$sourceCounts, &$uniqueUsers) {
            $sourceName = '';
            $score = 'ผ่านเกณฑ์';
            $scoreVal = 100;

            if (!empty($c->activity_id) && isset($allActs[$c->activity_id])) {
                $sourceName = $allActs[$c->activity_id];
            } elseif (!empty($c->source_id)) {
                if (isset($allSources[$c->source_id])) {
                    $sourceName = $allSources[$c->source_id];
                }
                $log = QuizLog::where('username', $c->username)
                    ->where('source_id', $c->source_id)
                    ->orderByDesc('created_at')
                    ->first();
                if ($log && $log->score !== null) {
                    $scoreVal = (float) $log->score;
                    $score = is_numeric($log->score) ? (number_format($scoreVal, 0) . '%') : (string) $log->score;
                }
            } elseif (!empty($c->base_id)) {
                if (isset($allBases[$c->base_id])) {
                    $sourceName = $allBases[$c->base_id];
                }
                $log = QuizLog::where('username', $c->username)
                    ->where('base_id', $c->base_id)
                    ->orderByDesc('created_at')
                    ->first();
                if ($log && $log->score !== null) {
                    $scoreVal = (float) $log->score;
                    $score = is_numeric($log->score) ? (number_format($scoreVal, 0) . '%') : (string) $log->score;
                }
            }

            if (!$sourceName) $sourceName = 'หลักสูตรการเรียนรู้ตามอัธยาศัย';

            $userTambon = $c->user?->tambon ?: 'ไม่ระบุตำบล';
            $tambonCounts[$userTambon] = ($tambonCounts[$userTambon] ?? 0) + 1;
            $sourceCounts[$sourceName] = ($sourceCounts[$sourceName] ?? 0) + 1;
            $uniqueUsers[$c->username] = true;

            $yearThai = ($c->issued_at ? (int) $c->issued_at->format('Y') : (int) date('Y')) + 543;
            $refNo = $c->cert_no ?: ('สกร.พร้าว/' . $yearThai . '-' . str_pad($c->id, 4, '0', STR_PAD_LEFT));
            $issuedFormatted = $c->issued_at?->format('d/m/Y') ?? $c->created_at?->format('d/m/Y') ?? now()->format('d/m/Y');

            return [
                'index'       => $idx + 1,
                'id'          => $c->id,
                'certId'      => $c->id,
                'refNo'       => $refNo,
                'certNo'      => $refNo,
                'username'    => $c->username,
                'fullName'    => $c->user?->full_name ?: $c->username,
                'phone'       => $c->user?->phone ?: $c->username,
                'tambon'      => $userTambon,
                'institution' => ($c->user?->institution_id === 'INS_MAERIM') ? 'สกร.ระดับอำเภอแม่ริม' : 'สกร.ระดับอำเภอพร้าว',
                'sourceId'    => $c->source_id ?: '',
                'activityId'  => $c->activity_id ?: '',
                'sourceName'  => $sourceName,
                'score'       => $score,
                'scoreNum'    => $scoreVal,
                'certUrl'     => $c->cert_url,
                'status'      => $c->status ?: 'Active',
                'issuedAt'    => $issuedFormatted,
                'issuedDate'  => $c->issued_at ? $c->issued_at->toIso8601String() : null,
                'signatory'   => 'นายประวิตร ประธรรมโย (ผอ.สกร.ระดับอำเภอพร้าว)',
            ];
        });

        return response()->json([
            'status' => 'success',
            'summary' => [
                'totalCerts'    => $rawList->count(),
                'totalStudents' => count($uniqueUsers),
                'totalSources'  => count($sourceCounts),
                'tambonBreakdown' => $tambonCounts,
                'sourceBreakdown' => $sourceCounts,
            ],
            'data'  => $items,
            'items' => $items,
        ]);
    }

    /** exportCertificateRegistryWord — ส่งออกรายงานทะเบียนคุมเกียรติบัตรเสนอผู้บริหารในรูปแบบ Microsoft Word (.doc) */
    public function exportCertificateRegistryWord(Request $request)
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor || !in_array($actor['role'], ['admin', 'teacher'])) {
            return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์เข้าถึง'], 403);
        }

        $registryRes = $this->getCertificateRegistry($request);
        $registryData = $registryRes->getData(true);
        $items = $registryData['items'] ?? [];
        $summary = $registryData['summary'] ?? [];

        $totalCerts = $summary['totalCerts'] ?? count($items);
        $totalStudents = $summary['totalStudents'] ?? 0;
        $totalSources = $summary['totalSources'] ?? 0;

        $instTitle = 'ศูนย์ส่งเสริมการเรียนรู้ระดับอำเภอพร้าว';
        $directorName = 'นายประวิตร ประธรรมโย';
        $directorTitle = 'ผู้อำนวยการศูนย์ส่งเสริมการเรียนรู้ระดับอำเภอพร้าว';

        $thaiMonths = [
            1 => 'มกราคม', 2 => 'กุมภาพันธ์', 3 => 'มีนาคม', 4 => 'เมษายน',
            5 => 'พฤษภาคม', 6 => 'มิถุนายน', 7 => 'กรกฎาคม', 8 => 'สิงหาคม',
            9 => 'กันยายน', 10 => 'ตุลาคม', 11 => 'พฤศจิกายน', 12 => 'ธันวาคม'
        ];
        $d = now();
        $dateReportStr = $d->day . ' ' . $thaiMonths[$d->month] . ' พ.ศ. ' . ($d->year + 543);

        $tableRowsHtml = '';
        foreach ($items as $idx => $row) {
            $tableRowsHtml .= "
                <tr>
                    <td style='text-align:center;'>" . ($idx + 1) . "</td>
                    <td style='text-align:center; font-family:\"TH Sarabun PSK\",monospace; font-weight:bold; color:#1e1b4b;'>" . htmlspecialchars($row['refNo'] ?? '') . "</td>
                    <td>" . htmlspecialchars($row['fullName'] ?? '') . "</td>
                    <td>" . htmlspecialchars($row['sourceName'] ?? '') . "</td>
                    <td style='text-align:center;'>" . htmlspecialchars($row['tambon'] ?? '') . "</td>
                    <td style='text-align:center;'>" . htmlspecialchars($row['issuedAt'] ?? '') . "</td>
                    <td style='text-align:center; font-weight:bold;'>" . htmlspecialchars($row['score'] ?? 'ผ่านเกณฑ์') . "</td>
                    <td style='text-align:center;'><span style='color:#059669; font-weight:bold;'>สมบูรณ์</span></td>
                </tr>
            ";
        }

        if (empty($tableRowsHtml)) {
            $tableRowsHtml = "<tr><td colspan='8' style='text-align:center; padding:15pt; color:#666;'>ไม่พบข้อมูลใบเกียรติบัตรตามเงื่อนไขที่เลือก</td></tr>";
        }

        $wordHtml = "
<html xmlns:o='urn:schemas-microsoft-com:office:office'
      xmlns:w='urn:schemas-microsoft-com:office:word'
      xmlns='http://www.w3.org/TR/REC-html40'>
<head>
<meta charset='utf-8'>
<title>รายงานทะเบียนคุมการออกใบเกียรติบัตร</title>
<!--[if gte mso 9]>
<xml>
 <w:WordDocument>
  <w:View>Print</w:View>
  <w:Zoom>100</w:Zoom>
  <w:DoNotOptimizeForBrowser/>
 </w:WordDocument>
</xml>
<![endif]-->
<style>
@page {
    size: 297mm 210mm;
    margin: 1.5cm 1.5cm 1.5cm 1.5cm;
    mso-page-orientation: landscape;
}
body {
    font-family: 'TH Sarabun PSK', 'TH Sarabun New', 'Sarabun', 'Cordia New', sans-serif;
    font-size: 14pt;
    line-height: 1.25;
    color: #000000;
}
.header-title {
    font-size: 18pt;
    font-weight: bold;
    text-align: center;
    margin-bottom: 2pt;
}
.header-sub {
    font-size: 15pt;
    font-weight: bold;
    text-align: center;
    color: #333333;
    margin-bottom: 8pt;
}
.meta-box {
    margin-bottom: 12pt;
    font-size: 13pt;
}
.summary-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 12pt;
}
.summary-table td {
    border: 1px solid #999999;
    padding: 6pt 10pt;
    font-size: 13pt;
    background-color: #f8fafc;
}
.registry-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 8pt;
    margin-bottom: 18pt;
}
.registry-table th {
    border: 1px solid #333333;
    background-color: #e2e8f0;
    padding: 5pt 4pt;
    font-size: 12pt;
    font-weight: bold;
    text-align: center;
}
.registry-table td {
    border: 1px solid #666666;
    padding: 4pt 5pt;
    font-size: 12pt;
    vertical-align: middle;
}
.sign-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 25pt;
}
.sign-table td {
    vertical-align: top;
    text-align: center;
    font-size: 13pt;
    padding: 0 10pt;
}
</style>
</head>
<body>

    <div style='text-align:center; margin-bottom:6pt;'>
        <div style='font-size:16pt; font-weight:bold;'>ตราครุฑ / กรมส่งเสริมการเรียนรู้</div>
    </div>

    <div class='header-title'>แบบรายงานทะเบียนคุมการออกใบประกาศนียบัตรและเกียรติบัตรการเรียนรู้</div>
    <div class='header-sub'>{$instTitle} กรมส่งเสริมการเรียนรู้ กระทรวงศึกษาธิการ</div>

    <table class='meta-box' style='width:100%;'>
        <tr>
            <td style='width:50%;'><b>หน่วยงานผู้จัดทำ:</b> {$instTitle}</td>
            <td style='width:50%; text-align:right;'><b>วันที่พิมพ์รายงาน:</b> {$dateReportStr}</td>
        </tr>
        <tr>
            <td><b>วัตถุประสงค์:</b> เพื่อรายงานสรุปทะเบียนคุมการออกหลักฐานเกียรติบัตรเสนอผู้บริหาร</td>
            <td style='text-align:right;'><b>ระบบงาน:</b> ระบบคลังสื่อและแหล่งเรียนรู้ดิจิทัล (Phrao Learning)</td>
        </tr>
    </table>

    <table class='summary-table'>
        <tr>
            <td style='width:33.3%; text-align:center;'>
                <b>จำนวนเกียรติบัตรที่ออกทั้งหมด</b><br>
                <span style='font-size:16pt; font-weight:bold; color:#0f766e;'>{$totalCerts} ฉบับ</span>
            </td>
            <td style='width:33.3%; text-align:center;'>
                <b>จำนวนผู้เรียนที่ได้รับ</b><br>
                <span style='font-size:16pt; font-weight:bold; color:#1d4ed8;'>{$totalStudents} คน</span>
            </td>
            <td style='width:33.3%; text-align:center;'>
                <b>จำนวนแหล่งเรียนรู้/กิจกรรม</b><br>
                <span style='font-size:16pt; font-weight:bold; color:#7c3aed;'>{$totalSources} แห่ง</span>
            </td>
        </tr>
    </table>

    <table class='registry-table'>
        <thead>
            <tr>
                <th style='width:5%;'>ลำดับ</th>
                <th style='width:17%;'>เลขที่อ้างอิงเกียรติบัตร</th>
                <th style='width:18%;'>ชื่อ - นามสกุล ผู้รับ</th>
                <th style='width:22%;'>หลักสูตร / แหล่งเรียนรู้ / กิจกรรม</th>
                <th style='width:12%;'>ตำบล / สังกัด</th>
                <th style='width:10%;'>วันที่ออก</th>
                <th style='width:8%;'>ผลคะแนน</th>
                <th style='width:8%;'>สถานะ</th>
            </tr>
        </thead>
        <tbody>
            {$tableRowsHtml}
        </tbody>
    </table>

    <table class='sign-table'>
        <tr>
            <td style='width:33.3%;'>
                (ลงชื่อ)........................................................<br>
                (........................................................)<br>
                <b>เจ้าหน้าที่ผู้รวบรวมและจัดทำทะเบียนคุม</b><br>
                วันที่........เดือน....................พ.ศ. ๒๕๖๙
            </td>
            <td style='width:33.3%;'>
                (ลงชื่อ)........................................................<br>
                (........................................................)<br>
                <b>หัวหน้างานส่งเสริมการเรียนรู้</b><br>
                วันที่........เดือน....................พ.ศ. ๒๕๖๙
            </td>
            <td style='width:33.3%;'>
                (ลงชื่อ)........................................................<br>
                ( {$directorName} )<br>
                <b>{$directorTitle}</b><br>
                วันที่........เดือน....................พ.ศ. ๒๕๖๙
            </td>
        </tr>
    </table>

</body>
</html>";

        $filename = "รายงานทะเบียนคุมเกียรติบัตร_" . date('Ymd_His') . ".doc";

        return response($wordHtml, 200, [
            'Content-Type'        => 'application/msword; charset=utf-8',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
            'Cache-Control'       => 'max-age=0, no-cache, no-store, must-revalidate',
            'Pragma'              => 'public',
        ]);
    }

    public function getUserPointsHistory(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        $username = $actor['username'] ?? '';
        if (!$username) return response()->json(['status' => 'error', 'message' => 'กรุณาเข้าสู่ระบบ'], 401);

        $data = PointsTransaction::where('username', $username)
            ->orderByDesc('created_at')
            ->limit(200)
            ->get()
            ->map(function($p) {
                $pts = (int) $p->points;
                $ptsStr = ($pts > 0 ? '+' : '') . $pts;
                $formattedDate = $p->created_at ? $p->created_at->format('d/m/Y H:i') : '';

                return [
                    'id'          => $p->id,
                    'type'        => $p->type,
                    'description' => $p->description,
                    'points'      => $ptsStr,
                    'pointsNum'   => $pts,
                    'date'        => $formattedDate,
                    'dateStr'     => $formattedDate,
                ];
            });

        return response()->json([
            'status'  => 'success',
            'data'    => $data,
            'history' => $data,
        ]);
    }

    public function getUserBadges(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        $username = $actor['username'] ?? '';
        if (!$username) return response()->json(['status' => 'error', 'message' => 'กรุณาเข้าสู่ระบบ'], 401);

        $quizCount = QuizLog::where('username', $username)
            ->whereRaw('LOWER(status) = ?', ['pass'])
            ->count();
        $logCount = LearningLog::where('username', $username)
            ->whereRaw('LOWER(status) = ?', ['approved'])
            ->count();
        $couponCount = Coupon::where('username', $username)
            ->whereRaw('LOWER(status) <> ?', ['cancelled'])
            ->count();

        // ข้อมูล Firebase รุ่นเดิมเก็บรอบหมุนไว้ใน points_transactions ขณะที่
        // ระบบ Laravel รุ่นใหม่มี spin_transactions จึงใช้ประวัติคะแนนก่อนและ
        // fallback ไปตารางใหม่เพื่อไม่ให้ความคืบหน้าของข้อมูลเดิมหายไป
        $spinPointCount = PointsTransaction::where('username', $username)
            ->whereIn('type', ['spin', 'spin_spend'])
            ->count();
        $spinCount = $spinPointCount > 0
            ? $spinPointCount
            : SpinTransaction::where('username', $username)->count();
        $totalScore = (int) (User::where('username', $username)->value('score') ?? 0);

        $badges = collect([
            ['id' => 'badge_quiz_1', 'name' => 'ผู้เริ่มต้นเรียนรู้', 'icon' => 'fa-seedling', 'description' => 'ทำแบบทดสอบผ่าน 1 ครั้ง', 'color' => '#10b981', 'currentValue' => $quizCount, 'targetValue' => 1],
            ['id' => 'badge_quiz_5', 'name' => 'นักล่าความรู้', 'icon' => 'fa-book-reader', 'description' => 'ทำแบบทดสอบผ่าน 5 ครั้ง', 'color' => '#3b82f6', 'currentValue' => $quizCount, 'targetValue' => 5],
            ['id' => 'badge_quiz_10', 'name' => 'ปราชญ์แห่งพร้าว', 'icon' => 'fa-graduation-cap', 'description' => 'ทำแบบทดสอบผ่าน 10 ครั้ง', 'color' => '#8b5cf6', 'currentValue' => $quizCount, 'targetValue' => 10],
            ['id' => 'badge_log_1', 'name' => 'ผู้สร้างสรรค์กิจกรรม', 'icon' => 'fa-lightbulb', 'description' => 'ส่งบันทึกกิจกรรมอนุมัติ 1 ครั้ง', 'color' => '#f59e0b', 'currentValue' => $logCount, 'targetValue' => 1],
            ['id' => 'badge_log_5', 'name' => 'นักกิจกรรมดีเด่น', 'icon' => 'fa-medal', 'description' => 'ส่งบันทึกกิจกรรมอนุมัติ 5 ครั้ง', 'color' => '#d97706', 'currentValue' => $logCount, 'targetValue' => 5],
            ['id' => 'badge_coupon_1', 'name' => 'ผู้สนับสนุนชุมชน', 'icon' => 'fa-shopping-bag', 'description' => 'แลกคูปองส่วนลด OTOP 1 ครั้ง', 'color' => '#ec4899', 'currentValue' => $couponCount, 'targetValue' => 1],
            ['id' => 'badge_spin_5', 'name' => 'ยอดนักเสี่ยงโชค', 'icon' => 'fa-dharmachakra', 'description' => 'หมุนวงล้อนำโชคครบ 5 ครั้ง', 'color' => '#06b6d4', 'currentValue' => $spinCount, 'targetValue' => 5],
            ['id' => 'badge_conqueror', 'name' => 'Glorious Conqueror', 'icon' => 'fa-crown', 'description' => 'สะสมแต้มสะสมครบ 1,000 แต้ม', 'color' => '#fbbf24', 'currentValue' => $totalScore, 'targetValue' => 1000],
        ])->map(function (array $badge) {
            $badge['unlocked'] = $badge['currentValue'] >= $badge['targetValue'];
            return $badge;
        })->values();

        return response()->json([
            'status' => 'success',
            'badges' => $badges,
            'data' => $badges,
        ]);
    }



    private function resolveLocalPath(?string $url): string
    {
        if (empty($url)) return '';
        if (str_starts_with($url, 'data:')) return $url;

        $pathOnly = $url;
        if (str_starts_with($url, 'http://') || str_starts_with($url, 'https://')) {
            $pathOnly = parse_url($url, PHP_URL_PATH) ?? '';
        }

        $rawClean     = ltrim($pathOnly, '/');
        $decoded      = urldecode($rawClean);
        $noStorage    = preg_replace('/^storage\//', '', $decoded);
        $noStorageRaw = preg_replace('/^storage\//', '', $rawClean);

        $candidates = [
            // public_path resolves the symlink target automatically
            public_path($decoded),
            public_path($rawClean),
            // Storage paths (underlying real storage)
            storage_path('app/public/' . $noStorage),
            storage_path('app/public/' . $noStorageRaw),
            storage_path('app/' . $decoded),
            storage_path('app/' . $rawClean),
            // public/storage symlink explicit path
            public_path('storage/' . $noStorage),
            public_path('storage/' . $noStorageRaw),
            // Absolute fallback
            base_path($decoded),
            base_path($rawClean),
        ];

        foreach ($candidates as $cand) {
            $cand = str_replace('\\', '/', $cand);
            if (file_exists($cand) && is_file($cand)) {
                $real = realpath($cand);
                return 'file:///' . str_replace('\\', '/', $real ?: $cand);
            }
        }

        // Last resort: return the original URL (DomPDF may fetch it directly)
        return $url;
    }

    /**
     * ขยับยกตำแหน่งวรรณยุกต์ระดับ 3 (ไม้เอก/ไม้โท/ไม้ตรี/ไม้จัตวา/การันต์) ที่ซ้อนหลังสระบนให้สูงขึ้น 5.5pt
     */
    private function liftThaiToneMarks(?string $text): string
    {
        if (empty($text)) return '';

        $upperVowels = 'ัิีึื็';
        return preg_replace_callback('/([' . $upperVowels . '])([\x{0E48}-\x{0E4C}])/u', function ($matches) {
            return $matches[1] . '<span style="position: relative; top: -5.5pt;">' . $matches[2] . '</span>';
        }, $text);
    }
}
