<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens;

    protected $fillable = [
        'username', 'phone', 'full_name', 'nickname', 'nickname_unlocked', 'password',
        'role', 'tambon', 'institution_id', 'user_category', 'age_group', 'occupation', 'score', 'level',
        'profile_image', 'image_status', 'password_reset_required', 'must_change_password',
        'cosmetics',
    ];

    protected $hidden = ['password'];

    protected $casts = [
        'score' => 'integer',
        'level' => 'integer',
        'password_reset_required' => 'boolean',
        'must_change_password' => 'boolean',
        'nickname_unlocked' => 'boolean',
        'cosmetics' => 'array',
    ];

    public function getDisplayName(): string
    {
        if ($this->nickname_unlocked && !empty($this->nickname)) {
            return $this->nickname;
        }
        return $this->full_name ?: $this->username;
    }

    // ===== Relationships =====

    public function quizLogs(): HasMany
    {
        return $this->hasMany(QuizLog::class, 'username', 'username');
    }

    public function learningLogs(): HasMany
    {
        return $this->hasMany(LearningLog::class, 'username', 'username');
    }

    public function coupons(): HasMany
    {
        return $this->hasMany(Coupon::class, 'username', 'username');
    }

    public function pointsTransactions(): HasMany
    {
        return $this->hasMany(PointsTransaction::class, 'username', 'username');
    }

    public function sourceCheckIns(): HasMany
    {
        return $this->hasMany(SourceCheckIn::class, 'username', 'username');
    }

    public function activityCheckIns(): HasMany
    {
        return $this->hasMany(ActivityCheckIn::class, 'username', 'username');
    }

    public function nfeHours(): HasMany
    {
        return $this->hasMany(NfeHour::class, 'username', 'username');
    }

    public function proposals(): HasMany
    {
        return $this->hasMany(Proposal::class, 'username', 'username');
    }

    public function certificates(): HasMany
    {
        return $this->hasMany(Certificate::class, 'username', 'username');
    }

    public function userBadges(): HasMany
    {
        return $this->hasMany(UserBadge::class, 'username', 'username');
    }

    // ===== Helpers =====

    public function isAdmin(): bool
    {
        return $this->role === 'admin';
    }

    public function isTeacher(): bool
    {
        return $this->role === 'teacher';
    }

    public function isSage(): bool
    {
        return $this->role === 'sage';
    }

    public function isAdminOrTeacher(): bool
    {
        return in_array($this->role, ['admin', 'teacher', 'sage']);
    }

    /**
     * ข้อมูล Public สำหรับ leaderboard / profile
     */
    public function toPublicArray(): array
    {
        return [
            'username'         => $this->username,
            'phone'            => $this->phone,
            'fullName'         => $this->full_name,
            'nickname'         => $this->nickname ?? '',
            'nicknameUnlocked' => (bool) $this->nickname_unlocked,
            'displayName'      => $this->getDisplayName(),
            'role'             => $this->role,
            'tambon'           => $this->tambon,
            'userCategory'     => $this->user_category ?? 'ประชาชนทั่วไป',
            'ageGroup'         => $this->age_group ?? '',
            'occupation'       => $this->occupation ?? '',
            'score'            => (int) $this->score,
            'level'            => (int) $this->level,
            'profileImage'     => $this->image_status === 'Approved' ? $this->profile_image : '',
            'imageStatus'      => $this->image_status,
            'passwordResetRequired' => (bool) ($this->must_change_password || $this->password_reset_required),
            'mustChangePassword'    => (bool) ($this->must_change_password || $this->password_reset_required),
        ];
    }

    /**
     * ข้อมูล Profile เต็มสำหรับตัวเอง
     */
    public function toProfileArray(): array
    {
        return [
            'username'         => $this->username,
            'phone'            => $this->phone,
            'fullName'         => $this->full_name,
            'nickname'         => $this->nickname ?? '',
            'nicknameUnlocked' => (bool) $this->nickname_unlocked,
            'displayName'      => $this->getDisplayName(),
            'role'             => $this->role,
            'tambon'           => $this->tambon,
            'userCategory'     => $this->user_category ?? 'ประชาชนทั่วไป',
            'ageGroup'         => $this->age_group ?? '',
            'occupation'       => $this->occupation ?? '',
            'score'            => (int) $this->score,
            'level'            => (int) $this->level,
            'profileImage'     => $this->profile_image,
            'imageStatus'      => $this->image_status,
            'passwordResetRequired' => (bool) ($this->must_change_password || $this->password_reset_required),
            'mustChangePassword'    => (bool) ($this->must_change_password || $this->password_reset_required),
            'institutionId'         => $this->institution_id ?? 'INS_PHRAO',
            'cosmetics'             => $this->cosmetics ?? ['owned' => [], 'equipped' => ['frame' => '', 'name_glow' => '', 'badge' => '']],
            'createdAt'             => $this->created_at?->toIso8601String(),
        ];
    }
}
