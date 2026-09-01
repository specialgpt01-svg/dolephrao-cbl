<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\PointsTransaction;
use App\Services\AuthService;
use App\Services\CacheService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CosmeticsController extends Controller
{
    /**
     * รายการไอเทมคลังทั้งหมดในร้านค้า
     */
    public static function getCatalog(): array
    {
        return [
            'frames' => [
                [
                    'id'          => 'frame_gold',
                    'name'        => 'กรอบทองคำจักรพรรดิ',
                    'category'    => 'frame',
                    'price'       => 250,
                    'icon'        => '👑',
                    'description' => 'กรอบรูปขอบทองคำเรืองแสง ระดับพรีเมียม',
                    'cssClass'    => 'frame-gold',
                ],
                [
                    'id'          => 'frame_cyber',
                    'name'        => 'กรอบนีออนไซเบอร์',
                    'category'    => 'frame',
                    'price'       => 400,
                    'icon'        => '⚡',
                    'description' => 'กรอบรูปแสงนีออนฟ้าอมชมพู สไตล์ไซเบอร์พังก์',
                    'cssClass'    => 'frame-cyber',
                ],
                [
                    'id'          => 'frame_fire',
                    'name'        => 'กรอบเพลิงสุริยะ',
                    'category'    => 'frame',
                    'price'       => 500,
                    'icon'        => '🔥',
                    'description' => 'กรอบรูปเปลวไฟอนิเมชัน กะพริบไล่เฉดร้อนแรง',
                    'cssClass'    => 'frame-fire',
                ],
                [
                    'id'          => 'frame_emerald',
                    'name'        => 'กรอบมรกตปัญญา',
                    'category'    => 'frame',
                    'price'       => 200,
                    'icon'        => '🌿',
                    'description' => 'กรอบรูปออร่าสีเขียวมรกตแห่งธรรมชาติและความรู้',
                    'cssClass'    => 'frame-emerald',
                ],
                [
                    'id'          => 'frame_rainbow',
                    'name'        => 'กรอบรุ้งจักรวาล',
                    'category'    => 'frame',
                    'price'       => 750,
                    'icon'        => '🌈',
                    'description' => 'กรอบรูปวงกลมรุ้งเคลื่อนไหว 360 องศา สุดอลังการ',
                    'cssClass'    => 'frame-rainbow',
                ],
                [
                    'id'          => 'frame_admin',
                    'name'        => 'กรอบผู้ดูแลระบบสูงสุด',
                    'category'    => 'frame',
                    'price'       => 0,
                    'icon'        => '🛡️',
                    'description' => 'กรอบรูปโล่ทองคำนีออนฟ้า สำหรับผู้ดูแลระบบเท่านั้น',
                    'cssClass'    => 'frame-admin',
                    'exclusiveRole' => 'admin',
                ],
                [
                    'id'          => 'frame_teacher',
                    'name'        => 'กรอบแม่พิมพ์มหาปราชญ์',
                    'category'    => 'frame',
                    'price'       => 0,
                    'icon'        => '🎓',
                    'description' => 'กรอบรูปมกุฎมรกตประกายทอง สำหรับคุณครูผู้สอน',
                    'cssClass'    => 'frame-teacher',
                    'exclusiveRole' => 'teacher',
                ],
            ],
            'name_glows' => [
                [
                    'id'          => 'glow_gold',
                    'name'        => 'ออร่าทองคำเรืองแสง',
                    'category'    => 'name_glow',
                    'price'       => 150,
                    'icon'        => '✨',
                    'description' => 'ชื่อเรืองแสงสีทองคำระยิบระยับ',
                    'cssClass'    => 'glow-gold',
                ],
                [
                    'id'          => 'glow_neon',
                    'name'        => 'นีออนไซเบอร์ป๊อป',
                    'category'    => 'name_glow',
                    'price'       => 250,
                    'icon'        => '💡',
                    'description' => 'ชื่อเรืองแสงนีออนฟ้าสดใส โดดเด่นในสะดุดตา',
                    'cssClass'    => 'glow-neon',
                ],
                [
                    'id'          => 'glow_rainbow',
                    'name'        => 'ข้อความรุ้งเคลื่อนไหว',
                    'category'    => 'name_glow',
                    'price'       => 400,
                    'icon'        => '🎨',
                    'description' => 'ตัวอักษรเปลี่ยนสีรุ้งเคลื่อนไหวตลอดเวลา',
                    'cssClass'    => 'glow-rainbow',
                ],
                [
                    'id'          => 'glow_fire',
                    'name'        => 'ออร่าเปลวเพลิง',
                    'category'    => 'name_glow',
                    'price'       => 350,
                    'icon'        => '🔥',
                    'description' => 'ชื่อเรืองแสงโทนส้มแดงเปลวไฟแห่งความมุ่งมั่น',
                    'cssClass'    => 'glow-fire',
                ],
                [
                    'id'          => 'glow_purple',
                    'name'        => 'ออร่าม่วงมหาปราชญ์',
                    'category'    => 'name_glow',
                    'price'       => 300,
                    'icon'        => '🔮',
                    'description' => 'ชื่อเรืองแสงสีม่วงลึกลับ ทรงพลัง',
                    'cssClass'    => 'glow-purple',
                ],
                [
                    'id'          => 'glow_admin',
                    'name'        => 'ออร่าจอมทัพผู้ดูแลระบบ',
                    'category'    => 'name_glow',
                    'price'       => 0,
                    'icon'        => '👑',
                    'description' => 'ข้อความเรืองแสงทองคำส้มแดง บารมีผู้ดูแลระบบ',
                    'cssClass'    => 'glow-admin',
                    'exclusiveRole' => 'admin',
                ],
                [
                    'id'          => 'glow_teacher',
                    'name'        => 'ออร่าครูผู้สอนทรงคุณวุฒิ',
                    'category'    => 'name_glow',
                    'price'       => 0,
                    'icon'        => '🎓',
                    'description' => 'ข้อความเรืองแสงมรกตฟ้า ปราชญ์ผู้ถ่ายทอดความรู้',
                    'cssClass'    => 'glow-teacher',
                    'exclusiveRole' => 'teacher',
                ],
            ],
            'badges' => [
                [
                    'id'          => 'badge_crown',
                    'name'        => 'มกุฎราชกุมาร',
                    'category'    => 'badge',
                    'price'       => 150,
                    'icon'        => '👑',
                    'description' => 'มงกุฎราชาแห่งการเรียนรู้',
                    'symbol'      => '👑',
                ],
                [
                    'id'          => 'badge_lightning',
                    'name'        => 'สายฟ้าแห่งปัญญา',
                    'category'    => 'badge',
                    'price'       => 150,
                    'icon'        => '⚡',
                    'description' => 'สายฟ้าความรู้ไวติดสปีด',
                    'symbol'      => '⚡',
                ],
                [
                    'id'          => 'badge_fire',
                    'name'        => 'ผู้เรียนไฟแรง',
                    'category'    => 'badge',
                    'price'       => 150,
                    'icon'        => '🔥',
                    'description' => 'เปลวไฟความมุ่งมั่นไม่ยอมแพ้',
                    'symbol'      => '🔥',
                ],
                [
                    'id'          => 'badge_diamond',
                    'name'        => 'ปราชญ์เพชรพร้าว',
                    'category'    => 'badge',
                    'price'       => 250,
                    'icon'        => '💎',
                    'description' => 'เพชรแท้แห่งการศึกษาอำเภอพร้าว',
                    'symbol'      => '💎',
                ],
                [
                    'id'          => 'badge_rocket',
                    'name'        => 'นักเรียนติดเทอร์โบ',
                    'category'    => 'badge',
                    'price'       => 200,
                    'icon'        => '🚀',
                    'description' => 'จรวดเรียนรู้ทะยานสู่เป้าหมาย',
                    'symbol'      => '🚀',
                ],
                [
                    'id'          => 'badge_admin',
                    'name'        => 'ผู้ดูแลระบบ',
                    'category'    => 'badge',
                    'price'       => 0,
                    'icon'        => '🛡️',
                    'description' => 'ตราผู้ดูแลระบบสูงสุด',
                    'symbol'      => '🛡️ ผู้ดูแลระบบ',
                    'exclusiveRole' => 'admin',
                ],
                [
                    'id'          => 'badge_teacher',
                    'name'        => 'ครูผู้สอน สกร.',
                    'category'    => 'badge',
                    'price'       => 0,
                    'icon'        => '🎓',
                    'description' => 'ตราครูผู้สอนทรงคุณวุฒิ',
                    'symbol'      => '🎓 ครูผู้สอน',
                    'exclusiveRole' => 'teacher',
                ],
            ],
            'titles' => [
                [
                    'id'          => 'unlock_nickname',
                    'name'        => 'บัตรปลดล็อกตั้งฉายาหน้าอันดับ',
                    'category'    => 'title',
                    'price'       => 300,
                    'icon'        => '🏷️',
                    'description' => 'ปลดล็อกสิทธิ์การตั้งชื่อฉายาสุดเท่เพื่อแสดงผลในหน้าอันดับและโปรไฟล์',
                    'cssClass'    => 'unlock-nickname',
                ],
            ],
        ];
    }

    /**
     * ดึงข้อมูลร้านค้าและรายการคลังของผู้เรียน
     */
    public function getCosmeticsCatalog(Request $request): JsonResponse
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

        $cosmetics = $user->cosmetics ?? ['owned' => [], 'equipped' => ['frame' => '', 'name_glow' => '', 'badge' => '']];
        if (!is_array($cosmetics)) $cosmetics = ['owned' => [], 'equipped' => ['frame' => '', 'name_glow' => '', 'badge' => '']];
        if (!isset($cosmetics['owned']) || !is_array($cosmetics['owned'])) $cosmetics['owned'] = [];
        if (!isset($cosmetics['equipped']) || !is_array($cosmetics['equipped'])) $cosmetics['equipped'] = ['frame' => '', 'name_glow' => '', 'badge' => ''];

        $catalog = self::getCatalog();
        $isStaff = in_array(strtolower((string)$user->role), ['admin', 'teacher', 'sage']);
        if ($isStaff) {
            $allIds = [];
            foreach ($catalog as $cat => $items) {
                foreach ($items as $it) {
                    $allIds[] = $it['id'];
                }
            }
            $cosmetics['owned'] = array_values(array_unique(array_merge($cosmetics['owned'], $allIds)));
        }

        return response()->json([
            'status'    => 'success',
            'userRole'  => $user->role,
            'isStaff'   => $isStaff,
            'userScore' => (int) $user->score,
            'cosmetics' => $cosmetics,
            'catalog'   => $catalog,
        ]);
    }

    /**
     * แลกซื้อไอเทมด้วยแต้มสะสม
     */
    public function buyCosmetic(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        $username = $actor['username'] ?? '';
        if (!$username) {
            return response()->json(['status' => 'error', 'message' => 'กรุณาเข้าสู่ระบบ'], 401);
        }

        $itemId = trim($request->input('itemId') ?? '');
        if (!$itemId) {
            return response()->json(['status' => 'error', 'message' => 'ไม่ระบุรหัสไอเทม']);
        }

        $catalog = self::getCatalog();
        $allItemMap = [];
        foreach ($catalog as $cat => $items) {
            foreach ($items as $it) {
                $allItemMap[$it['id']] = $it;
            }
        }

        if (!isset($allItemMap[$itemId])) {
            return response()->json(['status' => 'error', 'message' => 'ไม่พบไอเทมนี้ในร้านค้า']);
        }

        $targetItem = $allItemMap[$itemId];
        $user = User::where('username', $username)->first();
        if (!$user) {
            return response()->json(['status' => 'error', 'message' => 'ไม่พบผู้ใช้งาน'], 404);
        }

        $isStaff = in_array(strtolower((string)$user->role), ['admin', 'teacher', 'sage']);
        $price = $isStaff ? 0 : (int) $targetItem['price'];

        $cosmetics = $user->cosmetics ?? ['owned' => [], 'equipped' => ['frame' => '', 'name_glow' => '', 'badge' => '']];
        if (!is_array($cosmetics)) $cosmetics = ['owned' => [], 'equipped' => ['frame' => '', 'name_glow' => '', 'badge' => '']];
        if (!isset($cosmetics['owned']) || !is_array($cosmetics['owned'])) $cosmetics['owned'] = [];
        if (!isset($cosmetics['equipped']) || !is_array($cosmetics['equipped'])) $cosmetics['equipped'] = ['frame' => '', 'name_glow' => '', 'badge' => ''];

        if (in_array($itemId, $cosmetics['owned'])) {
            return response()->json(['status' => 'error', 'message' => 'คุณมีไอเทมนี้อยู่แล้ว']);
        }

        if (!$isStaff && (int) $user->score < $price) {
            return response()->json(['status' => 'error', 'message' => "แต้มสะสมไม่เพียงพอ (ต้องการ {$price} แต้ม, คุณมี {$user->score} แต้ม)"]);
        }

        // หักแต้มและเพิ่มไอเทมเข้าคลัง
        $newScore = (int) $user->score - $price;
        $cosmetics['owned'][] = $itemId;

        // สวมใส่อัตโนมัติทันทีที่ซื้อ (เว้นแต่เป็นบัตรปลดล็อก)
        $cat = $targetItem['category'];
        if ($cat !== 'title') {
            $cosmetics['equipped'][$cat] = $itemId;
        }

        $updateData = [
            'score'     => $newScore,
            'cosmetics' => $cosmetics,
        ];

        if ($itemId === 'unlock_nickname') {
            $updateData['nickname_unlocked'] = true;
        }

        $user->update($updateData);

        CacheService::forgetUserProfile($username);
        CacheService::invalidateLeaderboard();

        PointsTransaction::create([
            'username'    => $username,
            'type'        => 'cosmetic_buy',
            'description' => "ซื้อไอเทม: {$targetItem['name']}",
            'points'      => -$price,
            'ref_id'      => $itemId,
        ]);

        return response()->json([
            'status'    => 'success',
            'message'   => "แลกซื้อ {$targetItem['name']} สำเร็จแล้ว!",
            'newScore'  => $newScore,
            'cosmetics' => $cosmetics,
        ]);
    }

    /**
     * ติดตั้งหรือถอดไอเทมสวมใส่
     */
    public function equipCosmetic(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        $username = $actor['username'] ?? '';
        if (!$username) {
            return response()->json(['status' => 'error', 'message' => 'กรุณาเข้าสู่ระบบ'], 401);
        }

        $itemId = trim($request->input('itemId') ?? '');
        $category = trim($request->input('category') ?? ''); // frame, name_glow, badge

        $user = User::where('username', $username)->first();
        if (!$user) {
            return response()->json(['status' => 'error', 'message' => 'ไม่พบผู้ใช้งาน'], 404);
        }

        $cosmetics = $user->cosmetics ?? ['owned' => [], 'equipped' => ['frame' => '', 'name_glow' => '', 'badge' => '']];
        if (!is_array($cosmetics)) $cosmetics = ['owned' => [], 'equipped' => ['frame' => '', 'name_glow' => '', 'badge' => '']];
        if (!isset($cosmetics['owned']) || !is_array($cosmetics['owned'])) $cosmetics['owned'] = [];
        if (!isset($cosmetics['equipped']) || !is_array($cosmetics['equipped'])) $cosmetics['equipped'] = ['frame' => '', 'name_glow' => '', 'badge' => ''];

        // ถอดออก (Unequip)
        if ($itemId === '' || $itemId === 'none') {
            if ($category && isset($cosmetics['equipped'][$category])) {
                $cosmetics['equipped'][$category] = '';
            }
            $user->update(['cosmetics' => $cosmetics]);
            CacheService::forgetUserProfile($username);
            CacheService::invalidateLeaderboard();
            return response()->json([
                'status'    => 'success',
                'message'   => 'ถอดออกเรียบร้อยแล้ว',
                'cosmetics' => $cosmetics,
            ]);
        }

        $isStaff = in_array(strtolower((string)$user->role), ['admin', 'teacher', 'sage']);
        if (!$isStaff && !in_array($itemId, $cosmetics['owned'])) {
            return response()->json(['status' => 'error', 'message' => 'คุณยังไม่ได้เป็นเจ้าของไอเทมนี้']);
        }

        if (!in_array($itemId, $cosmetics['owned'])) {
            $cosmetics['owned'][] = $itemId;
        }

        $catalog = self::getCatalog();
        $targetItem = null;
        foreach ($catalog as $cat => $items) {
            foreach ($items as $it) {
                if ($it['id'] === $itemId) {
                    $targetItem = $it;
                    break 2;
                }
            }
        }

        if (!$targetItem) {
            return response()->json(['status' => 'error', 'message' => 'ไม่พบไอเทมนี้']);
        }

        $itemCat = $targetItem['category'];
        $cosmetics['equipped'][$itemCat] = $itemId;

        $user->update(['cosmetics' => $cosmetics]);
        CacheService::forgetUserProfile($username);
        CacheService::invalidateLeaderboard();

        return response()->json([
            'status'    => 'success',
            'message'   => "ติดตั้ง {$targetItem['name']} สำเร็จแล้ว",
            'cosmetics' => $cosmetics,
        ]);
    }
}
