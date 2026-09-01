<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('username', 100)->unique()->comment('รหัสผู้ใช้ (normalize: lowercase, trim)');
            $table->string('phone', 20)->nullable()->index()->comment('เบอร์โทรศัพท์');
            $table->string('full_name', 255)->nullable();
            $table->string('password', 255)->nullable()->comment('bcrypt hashed');
            $table->enum('role', ['admin', 'teacher', 'user'])->default('user')->index();
            $table->string('tambon', 100)->nullable()->index()->comment('ชื่อตำบล (normalize: lowercase)');
            $table->integer('score')->default(0)->index();
            $table->integer('level')->default(1);
            $table->text('profile_image')->nullable();
            $table->enum('image_status', ['Pending', 'Approved', 'Rejected'])->default('Pending');
            $table->timestamps();

            $table->index(['role', 'score']);
            $table->index(['tambon', 'score']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('users');
    }
};
