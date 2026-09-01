<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE sources MODIFY cert_template_id TEXT NULL');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE sources MODIFY cert_template_id VARCHAR(50) NULL');
    }
};
