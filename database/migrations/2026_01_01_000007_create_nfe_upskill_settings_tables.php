<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ชั่วโมง NFE (การศึกษานอกระบบ)
        Schema::create('nfe_hours', function (Blueprint $table) {
            $table->id();
            $table->string('username', 100)->index();
            $table->decimal('hours', 5, 1)->default(0)->comment('จำนวนชั่วโมงที่แลก');
            $table->integer('points_spent')->default(0)->comment('คะแนนที่ใช้ไป');
            $table->string('status', 50)->default('Pending')->index();
            $table->text('note')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->string('reviewed_by', 100)->nullable();
            $table->timestamps();

            $table->foreign('username')->references('username')->on('users')->onDelete('cascade');
        });

        // วิดีโอ UpSkill
        Schema::create('upskill_categories', function (Blueprint $table) {
            $table->id();
            $table->string('name', 255);
            $table->text('description')->nullable();
            $table->text('image_url')->nullable();
            $table->integer('display_order')->default(999);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('upskill_videos', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('category_id')->nullable()->index();
            $table->string('title', 255);
            $table->text('description')->nullable();
            $table->text('video_url');
            $table->text('thumbnail_url')->nullable();
            $table->integer('duration_seconds')->default(0);
            $table->integer('display_order')->default(999);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->foreign('category_id')->references('id')->on('upskill_categories')->onDelete('set null');
        });

        // ความคืบหน้าการดูวิดีโอ
        Schema::create('upskill_progress', function (Blueprint $table) {
            $table->id();
            $table->string('username', 100)->index();
            $table->unsignedBigInteger('video_id')->index();
            $table->integer('progress_seconds')->default(0)->comment('ดูถึงวินาทีที่');
            $table->boolean('completed')->default(false);
            $table->timestamps();

            $table->unique(['username', 'video_id']);
            $table->foreign('username')->references('username')->on('users')->onDelete('cascade');
            $table->foreign('video_id')->references('id')->on('upskill_videos')->onDelete('cascade');
        });

        // บันทึกการเรียนรู้ (UpSkill Learning Log — แตกต่างจาก learning_logs)
        Schema::create('upskill_learning_logs', function (Blueprint $table) {
            $table->id();
            $table->string('username', 100)->index();
            $table->text('content')->nullable()->comment('เนื้อหาที่บันทึก');
            $table->enum('status', ['Pending', 'Approved', 'Rejected'])->default('Pending')->index();
            $table->decimal('grade', 5, 2)->nullable()->comment('คะแนนที่ได้');
            $table->text('feedback')->nullable()->comment('ข้อคิดเห็นจากผู้ตรวจ');
            $table->timestamp('graded_at')->nullable();
            $table->string('graded_by', 100)->nullable();
            $table->timestamps();

            $table->foreign('username')->references('username')->on('users')->onDelete('cascade');
        });

        // Global Settings (key-value store)
        Schema::create('settings', function (Blueprint $table) {
            $table->string('key', 100)->primary();
            $table->json('value')->nullable();
            $table->timestamps();
        });

    }

    public function down(): void
    {
        Schema::dropIfExists('settings');
        Schema::dropIfExists('upskill_learning_logs');
        Schema::dropIfExists('upskill_progress');
        Schema::dropIfExists('upskill_videos');
        Schema::dropIfExists('upskill_categories');
        Schema::dropIfExists('nfe_hours');
    }
};
