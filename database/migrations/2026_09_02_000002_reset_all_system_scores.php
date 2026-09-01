<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\File;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        try {
            DB::statement('SET FOREIGN_KEY_CHECKS = 0');
        } catch (\Throwable $e) {}

        // 1. Reset all users score and level
        try {
            DB::table('users')->update([
                'score' => 0,
                'level' => 1,
            ]);
        } catch (\Throwable $e) {}

        // 2. Truncate certificates
        try {
            if (Schema::hasTable('certificates')) {
                DB::table('certificates')->truncate();
            }
        } catch (\Throwable $e) {}

        // 3. Truncate transactions, logs, and score-related records
        $tables = [
            'points_transactions',
            'quiz_logs',
            'learning_logs',
            'source_check_ins',
            'activity_check_ins',
            'activity_evaluations',
            'spin_transactions',
            'coupons',
            'upskill_learning_logs',
            'upskill_progress',
            'user_badges',
        ];

        foreach ($tables as $table) {
            try {
                if (Schema::hasTable($table)) {
                    DB::table($table)->truncate();
                }
            } catch (\Throwable $e) {}
        }

        try {
            DB::statement('SET FOREIGN_KEY_CHECKS = 1');
        } catch (\Throwable $e) {}

        // 4. Delete generated certificate files in storage
        try {
            $certDir = storage_path('app/public/certificates');
            if (File::isDirectory($certDir)) {
                $files = File::allFiles($certDir);
                foreach ($files as $file) {
                    @File::delete($file->getRealPath());
                }
            }
        } catch (\Throwable $e) {}
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No reverse for data reset
    }
};
