<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->string('external_id', 100)->nullable()->unique()->after('id');
            $table->string('category', 100)->nullable()->after('name');
            $table->string('contact', 255)->nullable()->after('description');
            $table->string('tambon', 100)->nullable()->index()->after('contact');
            $table->json('images')->nullable()->after('image_url');
        });

        Schema::table('quiz_logs', function (Blueprint $table) {
            $table->string('external_id', 150)->nullable()->unique()->after('id');
        });

        Schema::table('points_transactions', function (Blueprint $table) {
            $table->string('external_id', 150)->nullable()->unique()->after('id');
        });

        Schema::table('activity_check_ins', function (Blueprint $table) {
            $table->string('external_id', 150)->nullable()->unique()->after('id');
            $table->integer('scan_points')->default(0)->after('points');
            $table->integer('quiz_points')->default(0)->after('scan_points');
            $table->string('quiz_score', 50)->nullable()->after('quiz_points');
            $table->string('status', 50)->nullable()->after('quiz_score');
        });

        Schema::table('nfe_hours', function (Blueprint $table) {
            $table->string('external_id', 150)->nullable()->unique()->after('id');
        });

        Schema::table('upskill_categories', function (Blueprint $table) {
            $table->string('external_id', 100)->nullable()->unique()->after('id');
        });

        Schema::table('upskill_videos', function (Blueprint $table) {
            $table->string('external_id', 100)->nullable()->unique()->after('id');
        });
    }

    public function down(): void
    {
        Schema::table('upskill_videos', fn (Blueprint $table) => $table->dropColumn('external_id'));
        Schema::table('upskill_categories', fn (Blueprint $table) => $table->dropColumn('external_id'));
        Schema::table('nfe_hours', fn (Blueprint $table) => $table->dropColumn('external_id'));
        Schema::table('activity_check_ins', fn (Blueprint $table) => $table->dropColumn([
            'external_id', 'scan_points', 'quiz_points', 'quiz_score', 'status',
        ]));
        Schema::table('points_transactions', fn (Blueprint $table) => $table->dropColumn('external_id'));
        Schema::table('quiz_logs', fn (Blueprint $table) => $table->dropColumn('external_id'));
        Schema::table('products', fn (Blueprint $table) => $table->dropColumn([
            'external_id', 'category', 'contact', 'tambon', 'images',
        ]));
    }
};
