<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ใบประกาศนียบัตรที่ออกให้
        Schema::create('certificates', function (Blueprint $table) {
            $table->id();
            $table->string('username', 100)->index();
            $table->string('source_id', 20)->nullable()->index();
            $table->string('base_id', 20)->nullable()->index();
            $table->string('activity_id', 50)->nullable()->index();
            $table->string('cert_no', 100)->unique()->comment('เลขที่ใบประกาศ');
            $table->text('cert_url')->nullable()->comment('URL ไฟล์ PDF/PNG');
            $table->enum('status', ['Active', 'Revoked'])->default('Active')->index();
            $table->timestamp('issued_at')->nullable();
            $table->timestamp('revoked_at')->nullable();
            $table->string('revoked_by', 100)->nullable();
            $table->timestamps();

            $table->foreign('username')->references('username')->on('users')->onDelete('cascade');
        });

        // ป้ายความสำเร็จ (Badges)
        Schema::create('badges', function (Blueprint $table) {
            $table->id();
            $table->string('badge_key', 100)->unique()->comment('badge identifier');
            $table->string('name', 255);
            $table->text('description')->nullable();
            $table->text('image_url')->nullable();
            $table->string('condition_type', 50)->nullable()->comment('score_reach, quiz_count, check_in_count');
            $table->integer('condition_value')->default(0);
            $table->timestamps();
        });

        // ป้ายที่ user ได้รับ
        Schema::create('user_badges', function (Blueprint $table) {
            $table->id();
            $table->string('username', 100)->index();
            $table->string('badge_key', 100)->index();
            $table->timestamp('earned_at')->nullable();
            $table->timestamps();

            $table->unique(['username', 'badge_key']);
            $table->foreign('username')->references('username')->on('users')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_badges');
        Schema::dropIfExists('badges');
        Schema::dropIfExists('certificates');
    }
};
