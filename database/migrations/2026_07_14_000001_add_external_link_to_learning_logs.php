<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('learning_logs', 'external_link')) {
            Schema::table('learning_logs', function (Blueprint $table) {
                $table->text('external_link')->nullable()->after('description');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('learning_logs', 'external_link')) {
            Schema::table('learning_logs', function (Blueprint $table) {
                $table->dropColumn('external_link');
            });
        }
    }
};
