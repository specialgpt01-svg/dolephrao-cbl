<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;

/**
 * CacheService — เก็บเฉพาะ 3 items ที่จำเป็น
 *
 * ลบออกทั้งหมด:
 *  - dashboard cache (realtime)
 *  - homeData cache (realtime)
 *  - user-specific caches (realtime)
 *
 * เก็บเฉพาะ:
 *  - global_settings   → 12 ชั่วโมง
 *  - sources_list      → 30 นาที
 *  - leaderboard       → 5 นาที
 */
class CacheService
{
    const TTL_GLOBAL_SETTINGS = 12 * 60 * 60; // 12 ชม. (วินาที)
    const TTL_SOURCES_LIST    = 30 * 60;       // 30 นาที
    const TTL_LEADERBOARD     = 5 * 60;        // 5 นาที

    // ===== Global Settings =====

    public static function getGlobalSettings(callable $producer): mixed
    {
        return Cache::remember('global_settings', self::TTL_GLOBAL_SETTINGS, $producer);
    }

    public static function forgetGlobalSettings(): void
    {
        Cache::forget('global_settings');
    }

    // ===== Sources List =====

    public static function getSourcesList(callable $producer): mixed
    {
        return Cache::remember('sources_list', self::TTL_SOURCES_LIST, $producer);
    }

    public static function forgetSourcesList(): void
    {
        Cache::forget('sources_list');
    }

    // ===== Leaderboard =====

    public static function getLeaderboard(callable $producer, ?string $instId = null): mixed
    {
        $key = $instId ? 'leaderboard_' . $instId : 'leaderboard';
        return Cache::remember($key, self::TTL_LEADERBOARD, $producer);
    }

    public static function forgetLeaderboard(): void
    {
        Cache::forget('leaderboard');
        Cache::forget('leaderboard_INS_PHRAO');
        Cache::forget('leaderboard_INS_MAERIM');
        Cache::forget('leaderboard_ALL');
    }

    // ===== User Profile =====

    public static function getUserProfile(string $username, callable $producer): mixed
    {
        return Cache::remember('user_profile_' . $username, 3600, $producer);
    }

    public static function forgetUserProfile(string $username): void
    {
        Cache::forget('user_profile_' . $username);
    }

    // ===== Invalidation helpers =====

    /**
     * ล้าง cache ที่เกี่ยวกับ Sources (เมื่อ admin แก้ไขข้อมูล)
     */
    public static function invalidateSources(): void
    {
        self::forgetSourcesList();
    }

    /**
     * ล้าง cache ที่เกี่ยวกับ Users/Points (เมื่อมีการทำ quiz, check-in, ฯลฯ)
     */
    public static function invalidateLeaderboard(?string $username = null): void
    {
        self::forgetLeaderboard();
        if ($username) {
            self::forgetUserProfile($username);
        }
    }

    /**
     * ล้างทั้งหมด (ใช้ตอน debug หรือ deploy ใหม่)
     */
    public static function invalidateAll(): void
    {
        Cache::flush();
    }
}
