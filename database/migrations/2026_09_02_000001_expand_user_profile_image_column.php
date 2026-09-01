<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Use raw SQL to safely convert profile_image to LONGTEXT
        });
        
        try {
            DB::statement('ALTER TABLE `users` MODIFY COLUMN `profile_image` LONGTEXT NULL');
        } catch (\Throwable $e) {
            // Ignore if already modified or running in sqlite
        }
    }

    public function down(): void
    {
        try {
            DB::statement('ALTER TABLE `users` MODIFY COLUMN `profile_image` TEXT NULL');
        } catch (\Throwable $e) {
        }
    }
};
