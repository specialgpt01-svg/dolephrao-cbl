<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ประวัติการสอบ
        Schema::create('quiz_logs', function (Blueprint $table) {
            $table->id();
            $table->string('username', 100)->index();
            $table->string('source_id', 20)->nullable()->index();
            $table->string('base_id', 20)->nullable()->index();
            $table->decimal('score', 5, 2)->default(0);
            $table->enum('status', ['Pass', 'Fail'])->default('Fail');
            $table->text('cert_url')->nullable();
            $table->timestamps();

            $table->index(['username', 'source_id', 'base_id']);
            $table->foreign('username')->references('username')->on('users')->onDelete('cascade');
        });

        // บันทึกกิจกรรมการเรียนรู้ (แบบ log อิสระ ไม่ผ่านการสอบ)
        Schema::create('learning_logs', function (Blueprint $table) {
            $table->id();
            $table->string('log_id', 50)->unique()->comment('UUID or custom ID');
            $table->string('username', 100)->index();
            $table->string('activity_name', 255)->nullable();
            $table->text('description')->nullable();
            $table->text('external_link')->nullable();
            $table->enum('status', ['Pending', 'Approved', 'Rejected'])->default('Pending')->index();
            $table->decimal('score', 5, 2)->default(0);
            $table->text('note')->nullable()->comment('หมายเหตุจากครูผู้ตรวจ');
            $table->timestamp('reviewed_at')->nullable();
            $table->string('reviewed_by', 100)->nullable();
            $table->timestamps();

            $table->foreign('username')->references('username')->on('users')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('learning_logs');
        Schema::dropIfExists('quiz_logs');
    }
};
