<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'user_category')) {
                $table->string('user_category')->nullable()->default('ประชาชนทั่วไป')->after('tambon');
            }
            if (!Schema::hasColumn('users', 'age_group')) {
                $table->string('age_group')->nullable()->after('user_category');
            }
            if (!Schema::hasColumn('users', 'occupation')) {
                $table->string('occupation')->nullable()->after('age_group');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['user_category', 'age_group', 'occupation']);
        });
    }
};
