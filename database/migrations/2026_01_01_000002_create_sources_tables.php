<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // แหล่งเรียนรู้
        Schema::create('sources', function (Blueprint $table) {
            $table->string('id', 20)->primary()->comment('SRC0001');
            $table->string('name', 255)->index();
            $table->string('tambon', 100)->nullable()->index();
            $table->text('cover_image')->nullable();
            $table->string('latitude', 50)->nullable();
            $table->string('longitude', 50)->nullable();
            $table->text('description')->nullable();
            $table->string('subject_category', 100)->nullable();
            $table->decimal('credit_hours', 5, 1)->default(0);
            $table->integer('views')->default(0);
            $table->json('info')->nullable()->comment('history, contact, gps, gallery, external, result');
            $table->json('cert_template')->nullable()->comment('certificate template config');
            $table->text('cert_template_id')->nullable();
            $table->timestamps();
        });

        // ฐานการเรียนรู้ (แยกออกจาก sources[].bases)
        Schema::create('bases', function (Blueprint $table) {
            $table->string('id', 20)->primary()->comment('BAS0001');
            $table->string('source_id', 20)->index();
            $table->string('name', 255)->nullable();
            $table->text('description')->nullable();
            $table->text('cover_image')->nullable();
            $table->text('video_url')->nullable();
            $table->integer('display_order')->default(999);
            $table->boolean('is_active')->default(true);
            $table->json('info')->nullable()->comment('history, result, contact, gallery, external, gps');
            $table->json('cert_template')->nullable();
            $table->timestamps();

            $table->foreign('source_id')->references('id')->on('sources')->onDelete('cascade');
            $table->index(['source_id', 'display_order']);
        });

        // ข้อสอบ
        Schema::create('quizzes', function (Blueprint $table) {
            $table->id();
            $table->string('source_id', 20)->nullable()->index();
            $table->string('base_id', 20)->nullable()->index();
            $table->text('question');
            $table->json('choices')->comment('["A","B","C","D"]');
            $table->string('answer', 10)->comment('A, B, C หรือ D');
            $table->integer('display_order')->default(999);
            $table->timestamps();

            $table->index(['source_id', 'base_id', 'display_order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('quizzes');
        Schema::dropIfExists('bases');
        Schema::dropIfExists('sources');
    }
};
