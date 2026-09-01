<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\SourceController;
use App\Http\Controllers\Api\QuizController;
use App\Http\Controllers\Api\ActivityController;
use App\Http\Controllers\Api\CouponController;
use App\Http\Controllers\Api\CertificateController;
use App\Http\Controllers\Api\NfeController;
use App\Http\Controllers\Api\UpskillController;
use App\Http\Controllers\Api\SettingsController;
use App\Http\Controllers\Api\FileController;
use App\Http\Controllers\Api\LearningLogController;
use App\Http\Controllers\Api\CosmeticsController;
use App\Http\Controllers\Api\IDPlanController;
use App\Http\Controllers\Api\InstitutionController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes — LOFT LEARN
|--------------------------------------------------------------------------
| รองรับทั้ง:
|   1. Action-based (เหมือน Firebase เดิม): POST /api  { action: "...", data: {} }
|   2. REST endpoints (ใหม่)
|
| ให้ Frontend เดิมทำงานได้โดยไม่ต้องแก้โค้ดมาก
*/

// ===== Action-based single endpoint (เข้ากันได้กับ Frontend เดิม) =====
// RouteServiceProvider เพิ่ม prefix "api" ให้แล้ว → URL จริงคือ POST /api หรือ GET /api?action=...
Route::match(['GET', 'POST'], '/', function (Request $request) {
    $decodeQueryValue = function (mixed $value) use (&$decodeQueryValue): mixed {
        if (is_array($value)) {
            return array_map($decodeQueryValue, $value);
        }

        if (!is_string($value) || !str_starts_with($value, '__b64utf8__')) {
            return $value;
        }

        $decoded = base64_decode(substr($value, 11), true);

        return $decoded !== false && mb_check_encoding($decoded, 'UTF-8')
            ? $decoded
            : $value;
    };

    $jsonData = [];
    if ($request->method() === 'POST') {
        $rawContent = $request->getContent();
        if (!empty($rawContent)) {
            $decoded = json_decode($rawContent, true);
            if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                $jsonData = $decoded;
                $request->merge($jsonData);
            }
        }
    }

    $action = $request->input('action')
        ?: $request->query('action')
        ?: ($jsonData['action'] ?? '')
        ?: ($request->input('data.action') ?? '')
        ?: ($jsonData['data']['action'] ?? '');

    $action = trim((string) $action);

    $data = $request->input('data');
    if (!is_array($data)) {
        $data = !empty($jsonData) ? $jsonData : ($request->method() === 'POST' ? $request->all() : $decodeQueryValue($request->query()));
    }

    // Merge data เข้าใน request สำหรับ Controller
    if (is_array($data)) {
        $request->merge($data);
    }

    switch ($action) {
        // Auth
        case 'register':
            return app(AuthController::class)->register($request);
        case 'login':
            return app(AuthController::class)->login($request);
        case 'logout':
            return app(AuthController::class)->logout($request);
        case 'changePassword':
            return app(AuthController::class)->changePassword($request);

        // Users
        case 'getUserProfile':
        case 'getProfile':
            return app(UserController::class)->getProfile($request);
        case 'getLeaderboard':
            return app(UserController::class)->getLeaderboard($request);
        case 'getUsersByTambon':
            return app(UserController::class)->getUsersByTambon($request);
        case 'getEPortfolio':
            return app(UserController::class)->getEPortfolio($request);
        case 'getAdminLearnerDetail':
            return app(UserController::class)->getAdminLearnerDetail($request);
        case 'deleteUser':
            return app(UserController::class)->deleteUser($request);
        case 'updateUser':
        case 'updateUserDetails':
            return app(UserController::class)->updateUserDetails($request);
        case 'updateNickname':
            return app(UserController::class)->updateNickname($request);
        case 'createUserByAdmin':
            return app(UserController::class)->createUserByAdmin($request);
        case 'resetUserPasswordByAdmin':
            return app(UserController::class)->resetUserPasswordByAdmin($request);
        case 'forceChangePassword':
            return app(UserController::class)->forceChangePassword($request);
        case 'approveAvatar':
        case 'rejectAvatar':
        case 'approveProfileImage':
            return app(UserController::class)->approveProfileImage($request);
        case 'adjustUserScore':
        case 'adjustScore':
        case 'updateUserScore':
        case 'addDeductUserScore':
            return app(UserController::class)->adjustUserScore($request);
        case 'getUserPointsHistory':
        case 'getPointsHistory':
        case 'getPointsTransactions':
            return app(UserController::class)->getUserPointsHistory($request);
        case 'submitLog':
            return app(LearningLogController::class)->submitLog($request);
        case 'getUserLogs':
            return app(LearningLogController::class)->getUserLogs($request);
        case 'getPendingLogs':
            return app(LearningLogController::class)->getPendingLogs($request);
        case 'reviewLog':
            return app(LearningLogController::class)->reviewLog($request);

        // Sources
        case 'getSources':
            return app(SourceController::class)->getSources($request);
        case 'getSourceDetail':
            return app(SourceController::class)->getSourceDetail($request);
        case 'getMapSources':
            return app(SourceController::class)->getMapSources($request);
        case 'viewSource':
            return app(SourceController::class)->viewSource($request);
        case 'getAdminSources':
            return app(SourceController::class)->getAdminSources($request);
        case 'getAdminBasesBySource':
            return app(SourceController::class)->getAdminBasesBySource($request);
        case 'saveSource':
        case 'saveAdminSource':
            return app(SourceController::class)->saveAdminSource($request);
        case 'deleteSource':
        case 'deleteAdminSource':
            return app(SourceController::class)->deleteAdminSource($request);
        case 'saveBase':
        case 'saveAdminBase':
            return app(SourceController::class)->saveAdminBase($request);
        case 'deleteBase':
        case 'deleteAdminBase':
            return app(SourceController::class)->deleteAdminBase($request);
        case 'saveAdminBaseOrder':
            return app(SourceController::class)->saveAdminBaseOrder($request);
        case 'saveSourceEvaluation':
            return app(SourceController::class)->saveSourceEvaluation($request);
        case 'generateSourceStandardCert':
            return app(SourceController::class)->generateSourceStandardCert($request);
        case 'importSourcesCsv':
            return app(SourceController::class)->importSourcesCsv($request);

        // Institutions (Multi-Tenant)
        case 'getInstitutions':
            return app(InstitutionController::class)->getInstitutions($request);
        case 'createOrUpdateInstitution':
        case 'saveInstitution':
            return app(InstitutionController::class)->createOrUpdateInstitution($request);
        case 'updateSubUnits':
            return app(InstitutionController::class)->updateSubUnits($request);
        case 'deleteInstitution':
            return app(InstitutionController::class)->deleteInstitution($request);

        // Quizzes
        case 'getQuizzes':
            return app(QuizController::class)->getQuizzes($request);
        case 'submitQuiz':
            return app(QuizController::class)->submitQuiz($request);
        case 'getAdminQuizBySource':
            return app(QuizController::class)->getAdminQuizBySource($request);
        case 'saveAdminQuiz':
            return app(QuizController::class)->saveAdminQuiz($request);
        case 'saveAdminQuizBatch':
            return app(QuizController::class)->saveAdminQuizBatch($request);
        case 'deleteAdminQuiz':
            return app(QuizController::class)->deleteAdminQuiz($request);
        case 'saveAdminQuizOrder':
            return app(QuizController::class)->saveAdminQuizOrder($request);
        case 'importAdminQuizCsv':
            return app(QuizController::class)->importAdminQuizCsv($request);

        // Activities
        case 'getHomeData':
            return app(ActivityController::class)->getHomeData($request);
        case 'getHomeSummary':
            return app(ActivityController::class)->getHomeSummary($request);
        case 'getAdminHomeData':
        case 'getHomeAdminData':
            return app(ActivityController::class)->getAdminHomeData($request);
        case 'getDashboard':
            return app(ActivityController::class)->getDashboard($request);
        case 'saveFeaturedActivity':
            return app(ActivityController::class)->saveFeaturedActivity($request);
        case 'saveQuarterActivity':
            return app(ActivityController::class)->saveQuarterActivity($request);
        case 'syncExternalQuarterActivity':
            return app(ActivityController::class)->syncExternalQuarterActivity($request);
        case 'deleteQuarterActivity':
            return app(ActivityController::class)->deleteQuarterActivity($request);
        case 'getActivities':
            return app(ActivityController::class)->getActivities($request);
        case 'createActivity':
            return app(ActivityController::class)->createActivity($request);
        case 'updateActivity':
            return app(ActivityController::class)->updateActivity($request);
        case 'deleteActivity':
            return app(ActivityController::class)->deleteActivity($request);
        case 'checkInSource':
            return app(ActivityController::class)->checkInSource($request);
        case 'checkInActivity':
            return app(ActivityController::class)->checkInActivity($request);
        case 'getActivityCheckIns':
            return app(ActivityController::class)->getActivityCheckIns($request);
        case 'getActivityQuizzes':
            return app(ActivityController::class)->getActivityQuizzes($request);
        case 'saveActivityQuizzes':
            return app(ActivityController::class)->saveActivityQuizzes($request);
        case 'saveActivityCertificateTemplate':
            return app(ActivityController::class)->saveActivityCertificateTemplate($request);
        case 'submitActivityQuiz':
            return app(ActivityController::class)->submitActivityQuiz($request);
        case 'submitActivityEvaluation':
        case 'saveActivityEvaluation':
            return app(ActivityController::class)->submitActivityEvaluation($request);
        case 'getActivityEvaluationStatus':
            return app(ActivityController::class)->getActivityEvaluationStatus($request);
        case 'getActivityReportData':
        case 'getActivitySummaryReportData':
            return app(ActivityController::class)->getActivityReportData($request);
        case 'exportActivityProjectDocx':
        case 'downloadActivityProjectDocx':
            return app(ActivityController::class)->exportActivityProjectDocx($request);
        case 'submitProposal':
            return app(ActivityController::class)->submitProposal($request);
        case 'submitEvaluation':
            return app(ActivityController::class)->submitEvaluation($request);
        case 'submitSurvey':
            return app(ActivityController::class)->submitSurvey($request);
        case 'getUserProposals':
            return app(ActivityController::class)->getUserProposals($request);
        case 'getPendingProposals':
            return app(ActivityController::class)->getPendingProposals($request);
        case 'reviewProposal':
            return app(ActivityController::class)->reviewProposal($request);
        case 'getAISummary':
            return app(ActivityController::class)->getAISummary($request);
        case 'getAdminDashboardStats':
            return app(ActivityController::class)->getAdminDashboardStats($request);
        case 'uploadImage':
        case 'uploadSourceImage':
            return app(FileController::class)->uploadImage($request);
        case 'uploadGeneralImage':
            return app(FileController::class)->uploadGeneralImage($request);

        // Cosmetics & Shop
        case 'getCosmeticsCatalog':
            return app(CosmeticsController::class)->getCosmeticsCatalog($request);
        case 'buyCosmetic':
            return app(CosmeticsController::class)->buyCosmetic($request);
        case 'equipCosmetic':
            return app(CosmeticsController::class)->equipCosmetic($request);

        // ID Plan & AI Advisor
        case 'getIDPlans':
            return app(IDPlanController::class)->getIDPlans($request);
        case 'generateAIDraft':
            return app(IDPlanController::class)->generateAIDraft($request);
        case 'createOrUpdateIDPlan':
            return app(IDPlanController::class)->createOrUpdateIDPlan($request);
        case 'rePlanVisit':
            return app(IDPlanController::class)->rePlanVisit($request);
        case 'approveSageItem':
            return app(IDPlanController::class)->approveSageItem($request);

        // Coupons
        case 'getProducts':
        case 'getMarketProducts':
            return app(CouponController::class)->getProducts($request);
        case 'saveProduct':
        case 'saveMarketProduct':
            return app(CouponController::class)->saveProduct($request);
        case 'deleteProduct':
        case 'deleteMarketProduct':
            return app(CouponController::class)->deleteProduct($request);
        case 'redeemCoupon':
            return app(CouponController::class)->redeemCoupon($request);
        case 'getCoupons':
        case 'getUserCoupons':
            return app(CouponController::class)->getUserCoupons($request);
        case 'verifyCoupon':
        case 'verifyCouponAdmin':
            return app(CouponController::class)->verifyCouponAdmin($request);
        case 'useCoupon':
        case 'useCouponAdmin':
            return app(CouponController::class)->useCouponAdmin($request);
        case 'getAdminCoupons':
            return app(CouponController::class)->getAdminCoupons($request);
        case 'logPointsTransaction':
            return app(CouponController::class)->logPointsTransaction($request);
        case 'logSpinTransaction':
            return app(CouponController::class)->logSpinTransaction($request);
        case 'spin':
        case 'spinWheel':
        case 'spinLuckyWheel':
            return app(CouponController::class)->spinLuckyWheel($request);

        // Certificates
        case 'saveCertUrl':
            return app(CertificateController::class)->saveCertUrl($request);
        case 'getCertEditorSources':
            return app(CertificateController::class)->getCertEditorSources($request);
        case 'getCertTemplate':
        case 'getSourceCertTemplate':
            return app(CertificateController::class)->getCertTemplate($request);
        case 'saveCertTemplate':
        case 'saveSourceCertTemplate':
            return app(CertificateController::class)->saveCertTemplate($request);
        case 'generateCert':
        case 'generateCertificatePdf':
            return app(CertificateController::class)->generateCert($request);
        case 'downloadCertificate':
        case 'downloadCert':
            return app(CertificateController::class)->downloadCertificate($request);
        case 'revokeCert':
            return app(CertificateController::class)->revokeCert($request);
        case 'getUserCertificates':
            return app(CertificateController::class)->getUserCertificates($request);
        case 'getCertIssuanceHistory':
            return app(CertificateController::class)->getCertIssuanceHistory($request);
        case 'getCertificateRegistry':
            return app(CertificateController::class)->getCertificateRegistry($request);
        case 'exportCertificateRegistryWord':
            return app(CertificateController::class)->exportCertificateRegistryWord($request);
        case 'getUserPointsHistory':
            return app(CertificateController::class)->getUserPointsHistory($request);
        case 'getUserBadges':
            return app(CertificateController::class)->getUserBadges($request);

        // NFE
        case 'redeemNFEHours':
            return app(NfeController::class)->redeemNFEHours($request);
        case 'getNFEHistory':
        case 'getUserHours':
            return app(NfeController::class)->getNFEHistory($request);
        case 'getNFEAdminReport':
        case 'getNfeReports':
        case 'getNfeAdminReport':
            return app(NfeController::class)->getNFEAdminReport($request);
        case 'useNFEHours':
            return app(NfeController::class)->useNFEHours($request);

        // UpSkill
        case 'listUpSkillVideos':
        case 'listUpskillVideos':
        case 'getUpskillVideos':
        case 'listVideos':
            return app(UpskillController::class)->listVideos($request);
        case 'saveUpSkillVideo':
        case 'saveUpskillVideo':
        case 'saveVideo':
            return app(UpskillController::class)->saveVideo($request);
        case 'deleteUpSkillVideo':
        case 'deleteUpskillVideo':
        case 'deleteVideo':
            return app(UpskillController::class)->deleteVideo($request);
        case 'saveUpSkillProgress':
        case 'saveUpskillProgress':
        case 'saveProgress':
            return app(UpskillController::class)->saveProgress($request);
        case 'getUpSkillProgress':
        case 'getUpskillProgress':
        case 'getProgress':
            return app(UpskillController::class)->getProgress($request);
        case 'listUpSkillCategories':
        case 'listUpskillCategories':
        case 'getUpskillCategories':
        case 'listCategories':
            return app(UpskillController::class)->listCategories($request);
        case 'saveUpSkillCategory':
        case 'saveUpskillCategory':
        case 'saveCategory':
            return app(UpskillController::class)->saveCategory($request);
        case 'deleteUpSkillCategory':
        case 'deleteUpskillCategory':
        case 'deleteCategory':
            return app(UpskillController::class)->deleteCategory($request);
        case 'saveLearningLog':
        case 'submitUpskillLog':
            return app(UpskillController::class)->saveLearningLog($request);
        case 'getLearningLog':
            return app(UpskillController::class)->getLearningLog($request);
        case 'listLearningLogs':
        case 'listUpskillLearningLogs':
        case 'getUpskillLearningLogs':
        case 'getLearningLogs':
            return app(UpskillController::class)->listLearningLogs($request);
        case 'gradeLearningLog':
            return app(UpskillController::class)->gradeLearningLog($request);
        case 'completeUpskillVideo':
        case 'completeVideo':
            return app(UpskillController::class)->completeVideo($request);
        case 'updateUpskillVideoDuration':
        case 'updateVideoDuration':
            return app(UpskillController::class)->updateVideoDuration($request);

        // Settings
        case 'getGlobalSettings':
            return app(SettingsController::class)->getGlobalSettings($request);
        case 'saveGlobalSettings':
            return app(SettingsController::class)->saveGlobalSettings($request);
        case 'setGeminiKey':
            return app(SettingsController::class)->setGeminiKey($request);
        case 'testGeminiKey':
            return app(SettingsController::class)->testGeminiKey($request);
        case 'resetSystemScores':
        case 'resetScores':
            return app(SettingsController::class)->resetSystemScores($request);

        // Institutions (Multi-Tenant)
        case 'getInstitutions':
            return app(InstitutionController::class)->getInstitutions($request);
        case 'createOrUpdateInstitution':
        case 'saveInstitution':
            return app(InstitutionController::class)->createOrUpdateInstitution($request);
        case 'updateSubUnits':
            return app(InstitutionController::class)->updateSubUnits($request);
        case 'deleteInstitution':
            return app(InstitutionController::class)->deleteInstitution($request);

        // Files
        case 'getFirebaseFile':
            return app(FileController::class)->getFile($request);

        default:
            return response()->json(['status' => 'error', 'message' => "Unknown action: {$action}"], 400);
    }
});

// ===== REST Endpoints (สำหรับ Future use) =====
Route::prefix('v1')->group(function () {
    Route::post('auth/register', [AuthController::class, 'register']);
    Route::post('auth/login',    [AuthController::class, 'login']);

    Route::middleware('auth:sanctum')->group(function () {
        Route::post('auth/logout', [AuthController::class, 'logout']);

        Route::get('users/leaderboard',         [UserController::class, 'getLeaderboard']);
        Route::get('users/profile',             [UserController::class, 'getProfile']);
        Route::post('users/update-nickname',    [UserController::class, 'updateNickname']);
        Route::get('users/eportfolio',          [UserController::class, 'getEPortfolio']);
        Route::get('users/by-tambon',           [UserController::class, 'getUsersByTambon']);
        Route::get('admin/users/{username}',    [UserController::class, 'getAdminLearnerDetail']);
        Route::put('admin/users/{username}',    [UserController::class, 'updateUserDetails']);
        Route::delete('admin/users/{username}', [UserController::class, 'deleteUser']);
        Route::patch('admin/users/{username}/image-status', [UserController::class, 'approveProfileImage']);

        Route::get('sources',              [SourceController::class, 'getSources']);
        Route::get('sources/map',          [SourceController::class, 'getMapSources']);
        Route::get('sources/{id}',         [SourceController::class, 'getSourceDetail']);
        Route::post('sources/{id}/view',   [SourceController::class, 'viewSource']);
        Route::get('admin/sources',        [SourceController::class, 'getAdminSources']);
        Route::post('admin/sources',       [SourceController::class, 'saveAdminSource']);
        Route::put('admin/sources/{id}',   [SourceController::class, 'saveAdminSource']);
        Route::delete('admin/sources/{id}', [SourceController::class, 'deleteAdminSource']);
        Route::get('admin/sources/{id}/bases', [SourceController::class, 'getAdminBasesBySource']);
        Route::post('admin/bases',         [SourceController::class, 'saveAdminBase']);
        Route::put('admin/bases/{id}',     [SourceController::class, 'saveAdminBase']);
        Route::delete('admin/bases/{id}',  [SourceController::class, 'deleteAdminBase']);
        Route::post('admin/bases/order',   [SourceController::class, 'saveAdminBaseOrder']);

        Route::post('quizzes/submit',      [QuizController::class, 'submitQuiz']);
        Route::get('admin/quizzes',        [QuizController::class, 'getAdminQuizBySource']);
        Route::post('admin/quizzes',       [QuizController::class, 'saveAdminQuiz']);
        Route::post('admin/quizzes/batch', [QuizController::class, 'saveAdminQuizBatch']);
        Route::post('admin/quizzes/import-csv', [QuizController::class, 'importAdminQuizCsv']);
        Route::put('admin/quizzes/{id}',   [QuizController::class, 'saveAdminQuiz']);
        Route::delete('admin/quizzes/{id}', [QuizController::class, 'deleteAdminQuiz']);
        Route::post('admin/quizzes/order', [QuizController::class, 'saveAdminQuizOrder']);
    });
});
