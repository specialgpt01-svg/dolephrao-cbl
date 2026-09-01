<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('activity_evaluations', function (Blueprint $table) {
            $table->id();
            $table->string('activity_id', 50)->index();
            $table->string('activity_name', 255)->nullable();
            $table->string('username', 50)->index();
            $table->json('ratings')->nullable()->comment('Detailed ratings Likert scale 1-5');
            $table->decimal('overall_score', 4, 2)->default(5.00)->comment('Average rating');
            $table->text('feedback_impressions')->nullable()->comment('สิ่งที่ประทับใจ');
            $table->text('feedback_suggestions')->nullable()->comment('ข้อเสนอแนะปรับปรุง');
            $table->text('feedback_future_topics')->nullable()->comment('หัวข้อที่ต้องการให้จัดเพิ่ม');
            $table->string('gender', 30)->nullable();
            $table->string('age_group', 50)->nullable();
            $table->string('occupation', 100)->nullable();
            $table->string('tambon', 100)->nullable();
            $table->timestamps();

            $table->index(['activity_id', 'username']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('activity_evaluations');
    }
};
