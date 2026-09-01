<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // กิจกรรม (หลัก)
        Schema::create('activities', function (Blueprint $table) {
            $table->string('id', 50)->primary()->comment('activity UUID or custom ID');
            $table->string('name', 255);
            $table->text('description')->nullable();
            $table->text('cover_image')->nullable();
            $table->string('location', 255)->nullable();
            $table->string('tambon', 100)->nullable()->index();
            $table->enum('status', ['Active', 'Inactive', 'Draft'])->default('Draft')->index();
            $table->boolean('is_featured')->default(false);
            $table->text('certificate_template')->nullable()->comment('JSON cert template');
            $table->json('quiz_ids')->nullable()->comment('array of quiz IDs');
            $table->integer('check_in_points')->default(0);
            $table->integer('quiz_pass_score')->default(60);
            $table->timestamps();
        });

        // กิจกรรมประจำไตรมาส (quarter activities สำหรับ homeData)
        Schema::create('quarter_activities', function (Blueprint $table) {
            $table->string('id', 50)->primary()->comment('activityId');
            $table->string('activity_name', 255)->nullable();
            $table->text('description')->nullable();
            $table->text('image_url')->nullable();
            $table->string('location_name', 255)->nullable();
            $table->string('tambon', 100)->nullable();
            $table->integer('quarter')->default(1)->index();
            $table->integer('year')->default(2026)->index();
            $table->enum('status', ['Active', 'Inactive'])->default('Active');
            $table->integer('display_order')->default(999);
            $table->timestamps();

            $table->index(['quarter', 'year', 'status']);
        });

        // Home config - Featured Activity
        Schema::create('home_featured', function (Blueprint $table) {
            $table->id();
            $table->string('featured_id', 50)->nullable();
            $table->string('title', 255)->nullable();
            $table->text('image_url')->nullable();
            $table->string('location_name', 255)->nullable();
            $table->text('map_link')->nullable();
            $table->string('start_date', 50)->nullable();
            $table->string('end_date', 50)->nullable();
            $table->text('short_desc')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // Home Areas Config
        Schema::create('home_areas', function (Blueprint $table) {
            $table->id();
            $table->json('areas')->comment('รายชื่อพื้นที่ทั้งหมด');
            $table->timestamps();
        });

        // Check-in แหล่งเรียนรู้
        Schema::create('source_check_ins', function (Blueprint $table) {
            $table->id();
            $table->string('username', 100)->index();
            $table->string('source_id', 20)->index();
            $table->integer('points')->default(0);
            $table->timestamps();

            $table->unique(['username', 'source_id']);
            $table->foreign('username')->references('username')->on('users')->onDelete('cascade');
        });

        // Check-in กิจกรรม
        Schema::create('activity_check_ins', function (Blueprint $table) {
            $table->id();
            $table->string('username', 100)->index();
            $table->string('activity_id', 50)->index();
            $table->string('activity_name', 255)->nullable();
            $table->integer('points')->default(0);
            $table->timestamps();

            $table->unique(['username', 'activity_id']);
            $table->foreign('username')->references('username')->on('users')->onDelete('cascade');
        });

        // ข้อเสนอโครงการ (Proposals)
        Schema::create('proposals', function (Blueprint $table) {
            $table->id();
            $table->string('username', 100)->index();
            $table->string('activity_id', 50)->nullable()->index();
            $table->string('title', 255)->nullable();
            $table->text('description')->nullable();
            $table->enum('status', ['Pending', 'Approved', 'Rejected'])->default('Pending')->index();
            $table->text('note')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->string('reviewed_by', 100)->nullable();
            $table->json('evaluation_data')->nullable();
            $table->json('survey_data')->nullable();
            $table->timestamps();

            $table->foreign('username')->references('username')->on('users')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('proposals');
        Schema::dropIfExists('activity_check_ins');
        Schema::dropIfExists('source_check_ins');
        Schema::dropIfExists('home_areas');
        Schema::dropIfExists('home_featured');
        Schema::dropIfExists('quarter_activities');
        Schema::dropIfExists('activities');
    }
};
