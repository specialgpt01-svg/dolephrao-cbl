<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\Coupon;
use App\Models\PointsTransaction;
use App\Models\SpinTransaction;
use App\Models\User;
use App\Services\AuthService;
use App\Services\CacheService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;

class CouponController extends Controller
{
    public function getProducts(Request $request): JsonResponse
    {
        $query = Product::where('is_active', true);

        $district = trim((string) ($request->input('district') ?? ''));
        $instId   = trim((string) ($request->input('institutionId') ?? $request->input('institution_id') ?? ''));

        if ($instId === 'INS_PHRAO') {
            $district = 'พร้าว';
        } elseif ($instId === 'INS_MAERIM') {
            $district = 'แม่ริม';
        } elseif (in_array(strtoupper($instId), ['ALL', 'ทั้งหมด', 'ทุกอำเภอ', ''], true)) {
            $district = '';
        }

        $cleanDistrict = mb_strtolower($district);
        if ($cleanDistrict && !in_array($cleanDistrict, ['all', 'ทั้งหมด', 'ทุกอำเภอ', 'ทุกสังกัด'], true)) {
            $query->where('district', 'LIKE', '%' . $district . '%');
        }

        $tambon = trim((string) ($request->input('tambon') ?? ''));
        $cleanTambon = mb_strtolower($tambon);
        if ($cleanTambon && !in_array($cleanTambon, ['all', 'ทั้งหมด', 'ทุกตำบล'], true)) {
            $query->where('tambon', 'LIKE', '%' . $tambon . '%');
        }

        $products = $query->orderBy('id')->get()->map(function (Product $p) {
            $images = is_array($p->images) ? $p->images : [];
            if (empty($images) && !empty($p->image_url)) {
                $images = [$p->image_url];
            }
            $firstImage = !empty($images) ? (string) $images[0] : (!empty($p->image_url) ? (string) $p->image_url : '');
            // Strip any accidental wrapping JSON brackets or quotes
            if (str_starts_with($firstImage, '[')) {
                $decodedFirst = json_decode($firstImage, true);
                if (is_array($decodedFirst) && !empty($decodedFirst)) {
                    $firstImage = (string) $decodedFirst[0];
                }
            }
            $firstImage = trim($firstImage, "[]\"' \t\n\r\0\x0B");

            return [
                'id'          => $p->id,
                'productId'   => (string) $p->id,
                'externalId'  => $p->external_id,
                'name'        => $p->name,
                'category'    => $p->category,
                'description' => $p->description,
                'contact'     => $p->contact,
                'district'    => $p->district ?? 'อำเภอพร้าว',
                'tambon'      => $p->tambon,
                'imageUrl'    => $firstImage,
                'image_url'   => $firstImage,
                'image'       => $firstImage,
                'images'      => $images,
                'cost'        => $p->cost,
                'price'       => $p->price ?: (string) $p->cost,
                'stock'       => $p->stock,
            ];
        });
        return response()->json(['status' => 'success', 'data' => $products]);
    }

    public function saveProduct(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor || !in_array($actor['role'], ['admin', 'teacher'], true)) {
            return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์จัดการสินค้า'], 403);
        }

        $mode = strtolower(trim($request->input('mode') ?? 'create'));
        $images = $this->normalizeProductImages(
            $request->input('images') ?? $request->input('image') ?? $request->input('imageUrl') ?? ''
        );
        $price = trim((string) ($request->input('price') ?? $request->input('cost') ?? ''));

        $defaultDistrict = 'อำเภอพร้าว';
        if ($actor['institution_id'] === 'INS_MAERIM') {
            $defaultDistrict = 'อำเภอแม่ริม';
        }
        $inputDistrict = trim((string) ($request->input('district') ?? $defaultDistrict));

        $data = [
            'name'        => trim($request->input('name') ?? ''),
            'category'    => trim($request->input('category') ?? ''),
            'description' => trim($request->input('description') ?? ''),
            'contact'     => trim($request->input('contact') ?? ''),
            'district'    => $inputDistrict,
            'tambon'      => trim($request->input('tambon') ?? ''),
            'image_url'   => $images[0] ?? '',
            'images'      => $images,
            'cost'        => (int) ($request->input('cost') ?? preg_replace('/[^0-9]/', '', $price) ?? 0),
            'price'       => $price,
            'stock'       => (int) ($request->input('stock') ?? -1),
            'is_active'   => $request->input('isActive') !== false,
        ];

        if (!$data['name']) return response()->json(['status' => 'error', 'message' => 'กรุณากรอกชื่อสินค้า']);

        if ($mode === 'edit') {
            $product = Product::find($request->input('productId'));
            if (!$product) return response()->json(['status' => 'error', 'message' => 'ไม่พบสินค้า']);

            if ($actor['institution_id'] !== 'ALL') {
                if ($actor['institution_id'] === 'INS_MAERIM' && $product->district !== 'อำเภอแม่ริม') {
                    return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์แก้ไขสินค้าของสถานศึกษาอื่น'], 403);
                }
                if ($actor['institution_id'] === 'INS_PHRAO' && $product->district !== 'อำเภอพร้าว') {
                    return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์แก้ไขสินค้าของสถานศึกษาอื่น'], 403);
                }
            }

            $product->update($data);
        } else {
            $product = Product::create($data);
        }

        return response()->json(['status' => 'success', 'productId' => $product->id]);
    }

    public function deleteProduct(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor || !in_array($actor['role'], ['admin', 'teacher'], true)) {
            return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์ลบสินค้า'], 403);
        }
        $product = Product::find($request->input('productId'));
        if (!$product) return response()->json(['status' => 'error', 'message' => 'ไม่พบสินค้า']);

        if ($actor['institution_id'] !== 'ALL') {
            if ($actor['institution_id'] === 'INS_MAERIM' && $product->district !== 'อำเภอแม่ริม') {
                return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์ลบสินค้าของสถานศึกษาอื่น'], 403);
            }
            if ($actor['institution_id'] === 'INS_PHRAO' && $product->district !== 'อำเภอพร้าว') {
                return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์ลบสินค้าของสถานศึกษาอื่น'], 403);
            }
        }

        $product->delete();
        return response()->json(['status' => 'success']);
    }

    private function normalizeProductImages(mixed $value): array
    {
        if (is_string($value)) {
            $trimmed = trim($value);
            if ($trimmed === '') return [];
            $decoded = json_decode($trimmed, true);
            $value = is_array($decoded) ? $decoded : [$trimmed];
        }
        if (!is_array($value)) $value = [$value];
        return array_values(array_filter(array_map(fn ($item) => trim((string) $item), $value)));
    }

    public function redeemCoupon(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        $username = $actor['username'] ?? '';
        $productId = $request->input('productId');

        if (!$username) return response()->json(['status' => 'error', 'message' => 'กรุณาเข้าสู่ระบบ'], 401);

        return DB::transaction(function () use ($username, $productId) {
        $user    = User::where('username', $username)->lockForUpdate()->first();
        $product = Product::whereKey($productId)->lockForUpdate()->first();

        if (!$user)    return response()->json(['status' => 'error', 'message' => 'ไม่พบผู้ใช้ในระบบ']);
        if (!$product) return response()->json(['status' => 'error', 'message' => 'ไม่พบสินค้า']);
        if (!$product->is_active) return response()->json(['status' => 'error', 'message' => 'สินค้าหมดอายุ']);
        if ($product->stock === 0) return response()->json(['status' => 'error', 'message' => 'สินค้าหมด']);
        if ($user->score < $product->cost) return response()->json(['status' => 'error', 'message' => 'คะแนนไม่เพียงพอ']);

        // สร้างคูปอง
        $code = strtoupper(Str::random(10));
        $coupon = Coupon::create([
            'username'     => $username,
            'product_id'   => $product->id,
            'product_name' => $product->name,
            'code'         => $code,
            'cost'         => $product->cost,
            'status'       => 'Active',
        ]);

        // หักคะแนน
        $newScore = max(0, $user->score - $product->cost);
        $user->update(['score' => $newScore, 'level' => AuthService::levelFromScore($newScore)]);

        PointsTransaction::create([
            'username'    => $username,
            'type'        => 'redeem_coupon',
            'description' => "แลกรับ: {$product->name}",
            'points'      => -$product->cost,
            'ref_id'      => (string) $coupon->id,
        ]);

        // ลด stock
        if ($product->stock > 0) $product->decrement('stock');

        CacheService::invalidateLeaderboard();
        return response()->json([
            'status' => 'success',
            'couponCode' => $code,
            'couponId' => $coupon->id,
            'newScore' => $newScore,
        ]);
        });
    }

    public function getUserCoupons(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        $username = $actor['username'] ?? '';
        if (!$username) return response()->json(['status' => 'error', 'message' => 'กรุณาเข้าสู่ระบบ'], 401);

        $data = Coupon::where('username', $username)->orderByDesc('created_at')->get()->map(function($c) {
            preg_match('/(\d+)/', $c->product_name ?? '', $matches);
            $discountAmount = !empty($matches[1]) ? intval($matches[1]) : ($c->cost ?? 0);
            $redeemedAt = $c->created_at ? $c->created_at->format('d/m/Y H:i') : '';

            return [
                'id'             => $c->id,
                'code'           => $c->code,
                'productName'    => $c->product_name ?: 'คูปองส่วนลด',
                'cost'           => $c->cost,
                'pointsUsed'     => $c->cost,
                'discountAmount' => $discountAmount,
                'status'         => $c->status,
                'redeemedAt'     => $redeemedAt,
                'createdAt'      => $redeemedAt,
                'usedAt'         => $c->used_at ? $c->used_at->format('d/m/Y H:i') : '',
            ];
        });

        return response()->json(['status' => 'success', 'data' => $data]);
    }

    public function verifyCouponAdmin(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor || !in_array($actor['role'], ['admin', 'teacher'])) {
            return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์'], 403);
        }
        $code   = strtoupper(trim($request->input('code') ?? ''));
        $coupon = Coupon::with(['user', 'product'])->where('code', $code)->first();

        if (!$coupon) return response()->json(['status' => 'error', 'message' => 'ไม่พบคูปอง']);

        if ($actor['institution_id'] !== 'ALL') {
            $userInst = $coupon->user?->institution_id ?? 'INS_PHRAO';
            $prodDistrict = $coupon->product?->district ?? 'อำเภอพร้าว';

            if ($actor['institution_id'] === 'INS_MAERIM' && $userInst !== 'INS_MAERIM' && $prodDistrict !== 'อำเภอแม่ริม') {
                return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์ตรวจสอบคูปองของต่างสถานศึกษา'], 403);
            }
            if ($actor['institution_id'] === 'INS_PHRAO' && $userInst !== 'INS_PHRAO' && $prodDistrict !== 'อำเภอพร้าว') {
                return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์ตรวจสอบคูปองของต่างสถานศึกษา'], 403);
            }
        }

        return response()->json(['status' => 'success', 'coupon' => [
            'id'          => $coupon->id,
            'code'        => $coupon->code,
            'username'    => $coupon->username,
            'fullName'    => $coupon->user?->full_name ?? '',
            'productName' => $coupon->product_name,
            'cost'        => $coupon->cost,
            'status'      => $coupon->status,
        ]]);
    }

    public function useCouponAdmin(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor || !in_array($actor['role'], ['admin', 'teacher'])) {
            return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์'], 403);
        }
        $code   = strtoupper(trim($request->input('code') ?? ''));
        $coupon = Coupon::with(['user', 'product'])->where('code', $code)->first();

        if (!$coupon) return response()->json(['status' => 'error', 'message' => 'ไม่พบคูปอง']);
        if ($coupon->status === 'Used') return response()->json(['status' => 'error', 'message' => 'คูปองถูกใช้ไปแล้ว']);

        if ($actor['institution_id'] !== 'ALL') {
            $userInst = $coupon->user?->institution_id ?? 'INS_PHRAO';
            $prodDistrict = $coupon->product?->district ?? 'อำเภอพร้าว';

            if ($actor['institution_id'] === 'INS_MAERIM' && $userInst !== 'INS_MAERIM' && $prodDistrict !== 'อำเภอแม่ริม') {
                return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์ตัดยอดคูปองของต่างสถานศึกษา'], 403);
            }
            if ($actor['institution_id'] === 'INS_PHRAO' && $userInst !== 'INS_PHRAO' && $prodDistrict !== 'อำเภอพร้าว') {
                return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์ตัดยอดคูปองของต่างสถานศึกษา'], 403);
            }
        }

        $coupon->update([
            'status'  => 'Used',
            'used_at' => now(),
            'used_by' => $actor['username'],
        ]);

        return response()->json(['status' => 'success']);
    }

    public function getAdminCoupons(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor || !in_array($actor['role'], ['admin', 'teacher'], true)) {
            return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์'], 403);
        }

        $instId = trim($request->input('institutionId') ?? $actor['institution_id'] ?? 'INS_PHRAO');
        if ($actor['institution_id'] !== 'ALL') {
            $instId = $actor['institution_id'];
        }

        $query = Coupon::with(['user', 'product'])->orderByDesc('id');

        if ($instId !== 'ALL') {
            $query->where(function ($q) use ($instId) {
                if ($instId === 'INS_MAERIM') {
                    $q->whereHas('user', fn ($u) => $u->where('institution_id', 'INS_MAERIM'))
                      ->orWhereHas('product', fn ($p) => $p->where('district', 'อำเภอแม่ริม'));
                } else {
                    $q->whereHas('user', fn ($u) => $u->where('institution_id', '!=', 'INS_MAERIM'))
                      ->orWhereHas('product', fn ($p) => $p->where('district', '!=', 'อำเภอแม่ริม'));
                }
            });
        }

        $data = $query->get()->map(function ($c) {
            return [
                'id'          => $c->id,
                'code'        => $c->code,
                'username'    => $c->username,
                'fullName'    => $c->user?->full_name ?? '',
                'institution' => $c->user?->institution_id ?? 'INS_PHRAO',
                'productName' => $c->product_name,
                'district'    => $c->product?->district ?? 'อำเภอพร้าว',
                'cost'        => $c->cost,
                'status'      => $c->status,
                'usedBy'      => $c->used_by,
                'usedAt'      => $c->used_at ? $c->used_at->format('d/m/Y H:i') : '',
                'createdAt'   => $c->created_at ? $c->created_at->format('d/m/Y H:i') : '',
            ];
        });

        return response()->json(['status' => 'success', 'data' => $data, 'institutionId' => $instId]);
    }

    public function logPointsTransaction(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor || $actor['role'] !== 'admin') {
            return response()->json(['status' => 'error', 'message' => 'เฉพาะผู้ดูแลระบบเท่านั้น'], 403);
        }
        $username = AuthService::normalizeUsername($request->input('targetUsername') ?? $request->input('username') ?? '');
        $type     = trim($request->input('type') ?? 'manual');
        $desc     = trim($request->input('description') ?? '');
        $points   = (int) ($request->input('points') ?? 0);

        if (!$username) return response()->json(['status' => 'error', 'message' => 'ไม่พบผู้ใช้']);

        $user = User::where('username', $username)->first();
        if (!$user) return response()->json(['status' => 'error', 'message' => 'ไม่พบผู้ใช้ในระบบ']);

        PointsTransaction::create(['username' => $username, 'type' => $type, 'description' => $desc, 'points' => $points]);

        if ($points !== 0) {
            $newScore = max(0, $user->score + $points);
            $user->update(['score' => $newScore, 'level' => AuthService::levelFromScore($newScore)]);
            CacheService::invalidateLeaderboard();
        }

        return response()->json(['status' => 'success']);
    }

    public function logSpinTransaction(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        $username = $actor['username'] ?? '';
        $pointsSpent = (int) ($request->input('pointsSpent') ?? 0);
        $pointsWon   = (int) ($request->input('pointsWon') ?? 0);
        $prizeLabel  = trim($request->input('prizeLabel') ?? '');

        if (!$username) return response()->json(['status' => 'error', 'message' => 'กรุณาเข้าสู่ระบบ'], 401);

        \App\Models\SpinTransaction::create([
            'username'    => $username,
            'points_spent' => $pointsSpent,
            'points_won'   => $pointsWon,
            'prize_label'  => $prizeLabel,
        ]);

        return response()->json(['status' => 'success']);
    }

    public function spinLuckyWheel(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        $username = $actor['username'] ?? '';
        if (!$username) return response()->json(['status' => 'error', 'message' => 'กรุณาเข้าสู่ระบบ'], 401);

        $spinCost = 20;
        $prizes = [
            ['label' => 'ลองใหม่นะ 🍀', 'type' => 'none', 'points' => 0],
            ['label' => '5 แต้ม 🪙', 'type' => 'points', 'points' => 5],
            ['label' => '10 แต้ม 💎', 'type' => 'points', 'points' => 10],
            ['label' => 'ลองใหม่นะ 🍀', 'type' => 'none', 'points' => 0],
            ['label' => '20 แต้ม 🌟', 'type' => 'points', 'points' => 20],
            ['label' => 'คูปอง 20 บ. 🎟️', 'type' => 'coupon', 'points' => 0],
            ['label' => '50 แต้ม 🔥', 'type' => 'points', 'points' => 50],
            ['label' => 'คูปอง 50 บ. 👑', 'type' => 'coupon', 'points' => 0],
        ];
        $prizeIndex = array_rand($prizes);
        $prize = $prizes[$prizeIndex];
        $newScore = 0;
        $couponCode = null;

        try {
            DB::transaction(function () use ($username, $spinCost, $prize, &$newScore, &$couponCode) {
                $user = User::where('username', $username)->lockForUpdate()->firstOrFail();
                if ((int) $user->score < $spinCost) {
                    throw new \DomainException("ต้องการ {$spinCost} คะแนนในการหมุน");
                }

                $netPoints = (int) $prize['points'] - $spinCost;
                $newScore = (int) $user->score + $netPoints;
                $user->update(['score' => $newScore, 'level' => AuthService::levelFromScore($newScore)]);

                if ($prize['type'] === 'coupon') {
                    $couponCode = strtoupper(Str::random(10));
                    Coupon::create([
                        'username' => $username, 'product_name' => $prize['label'],
                        'code' => $couponCode, 'cost' => 0, 'status' => 'Active',
                    ]);
                }

                SpinTransaction::create([
                    'username' => $username, 'points_spent' => $spinCost,
                    'points_won' => (int) $prize['points'], 'prize_label' => $prize['label'],
                ]);
                PointsTransaction::create([
                    'username' => $username, 'type' => 'spin',
                    'description' => 'หมุนวงล้อ — '.$prize['label'], 'points' => $netPoints,
                ]);
            });
        } catch (\DomainException $e) {
            return response()->json(['status' => 'error', 'message' => $e->getMessage()]);
        }

        CacheService::invalidateLeaderboard();
        return response()->json([
            'status' => 'success', 'prizeIndex' => $prizeIndex,
            'prizeWon' => (int) $prize['points'], 'prizeLabel' => $prize['label'],
            'prizeType' => $prize['type'], 'couponCode' => $couponCode,
            'newScore' => $newScore,
        ]);
    }
}
