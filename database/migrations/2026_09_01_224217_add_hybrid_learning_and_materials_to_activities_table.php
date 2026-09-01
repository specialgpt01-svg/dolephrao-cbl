<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (Schema::hasTable('activities')) {
            Schema::table('activities', function (Blueprint $table) {
                if (!Schema::hasColumn('activities', 'learning_materials')) {
                    $table->json('learning_materials')->nullable()->after('quiz_ids');
                }
                if (!Schema::hasColumn('activities', 'external_links')) {
                    $table->json('external_links')->nullable()->after('learning_materials');
                }
                if (!Schema::hasColumn('activities', 'video_url')) {
                    $table->string('video_url', 500)->nullable()->after('external_links');
                }
                if (!Schema::hasColumn('activities', 'is_online_enabled')) {
                    $table->boolean('is_online_enabled')->default(true)->after('video_url');
                }
                if (!Schema::hasColumn('activities', 'online_description')) {
                    $table->text('online_description')->nullable()->after('is_online_enabled');
                }
            });
        }

        if (Schema::hasTable('quarter_activities')) {
            Schema::table('quarter_activities', function (Blueprint $table) {
                if (!Schema::hasColumn('quarter_activities', 'learning_materials')) {
                    $table->json('learning_materials')->nullable();
                }
                if (!Schema::hasColumn('quarter_activities', 'external_links')) {
                    $table->json('external_links')->nullable();
                }
                if (!Schema::hasColumn('quarter_activities', 'video_url')) {
                    $table->string('video_url', 500)->nullable();
                }
                if (!Schema::hasColumn('quarter_activities', 'is_online_enabled')) {
                    $table->boolean('is_online_enabled')->default(true);
                }
                if (!Schema::hasColumn('quarter_activities', 'online_description')) {
                    $table->text('online_description')->nullable();
                }
            });
        }

        if (Schema::hasTable('certificates')) {
            Schema::table('certificates', function (Blueprint $table) {
                if (!Schema::hasColumn('certificates', 'attendance_type')) {
                    $table->string('attendance_type', 30)->default('onsite')->after('activity_id');
                }
            });
        }

        if (Schema::hasTable('quiz_logs')) {
            Schema::table('quiz_logs', function (Blueprint $table) {
                if (!Schema::hasColumn('quiz_logs', 'attendance_type')) {
                    $table->string('attendance_type', 30)->default('onsite')->after('activity_id');
                }
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('activities')) {
            Schema::table('activities', function (Blueprint $table) {
                $table->dropColumn(['learning_materials', 'external_links', 'video_url', 'is_online_enabled', 'online_description']);
            });
        }

        if (Schema::hasTable('quarter_activities')) {
            Schema::table('quarter_activities', function (Blueprint $table) {
                $table->dropColumn(['learning_materials', 'external_links', 'video_url', 'is_online_enabled', 'online_description']);
            });
        }

        if (Schema::hasTable('certificates')) {
            Schema::table('certificates', function (Blueprint $table) {
                $table->dropColumn('attendance_type');
            });
        }

        if (Schema::hasTable('quiz_logs')) {
            Schema::table('quiz_logs', function (Blueprint $table) {
                $table->dropColumn('attendance_type');
            });
        }
    }
};
