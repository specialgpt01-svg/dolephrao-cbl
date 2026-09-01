<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('quizzes') && !Schema::hasColumn('quizzes', 'quiz_type')) {
            Schema::table('quizzes', function (Blueprint $table) {
                $table->string('quiz_type', 20)->default('posttest')->after('base_id')->index();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('quizzes') && Schema::hasColumn('quizzes', 'quiz_type')) {
            Schema::table('quizzes', function (Blueprint $table) {
                $table->dropColumn('quiz_type');
            });
        }
    }
};
