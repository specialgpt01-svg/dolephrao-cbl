<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('upskill_categories', function (Blueprint $table) {
            if (!Schema::hasColumn('upskill_categories', 'icon')) {
                $table->string('icon', 100)->default('fa-video')->after('name');
            }
            if (!Schema::hasColumn('upskill_categories', 'color')) {
                $table->string('color', 20)->default('#10b981')->after('icon');
            }
        });

        Schema::table('upskill_learning_logs', function (Blueprint $table) {
            if (!Schema::hasColumn('upskill_learning_logs', 'video_id')) {
                $table->unsignedBigInteger('video_id')->nullable()->after('username')->index();
            }
            if (!Schema::hasColumn('upskill_learning_logs', 'video_title')) {
                $table->string('video_title')->nullable()->after('video_id');
            }
            if (!Schema::hasColumn('upskill_learning_logs', 'category_id')) {
                $table->unsignedBigInteger('category_id')->nullable()->after('video_title')->index();
            }
        });
    }

    public function down(): void
    {
        Schema::table('upskill_learning_logs', function (Blueprint $table) {
            $columns = array_values(array_filter(
                ['video_id', 'video_title', 'category_id'],
                fn (string $column) => Schema::hasColumn('upskill_learning_logs', $column)
            ));
            if ($columns) {
                $table->dropColumn($columns);
            }
        });

        Schema::table('upskill_categories', function (Blueprint $table) {
            $columns = array_values(array_filter(
                ['icon', 'color'],
                fn (string $column) => Schema::hasColumn('upskill_categories', $column)
            ));
            if ($columns) {
                $table->dropColumn($columns);
            }
        });
    }
};
