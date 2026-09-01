<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('quiz_logs', function (Blueprint $table) {
            $table->string('external_source_id', 100)->nullable()->after('external_id');
            $table->string('external_base_id', 100)->nullable()->after('external_source_id');
        });
    }

    public function down(): void
    {
        Schema::table('quiz_logs', function (Blueprint $table) {
            $table->dropColumn(['external_source_id', 'external_base_id']);
        });
    }
};
