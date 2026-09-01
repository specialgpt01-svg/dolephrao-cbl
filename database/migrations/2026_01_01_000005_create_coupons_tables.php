<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // สินค้า/ของรางวัล
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->string('name', 255);
            $table->text('description')->nullable();
            $table->text('image_url')->nullable();
            $table->integer('cost')->default(0)->comment('ราคาเป็นคะแนน');
            $table->integer('stock')->default(0)->comment('-1 = unlimited');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // คูปองที่แลกแล้ว
        Schema::create('coupons', function (Blueprint $table) {
            $table->id();
            $table->string('username', 100)->index();
            $table->unsignedBigInteger('product_id')->nullable()->index();
            $table->string('product_name', 255)->nullable();
            $table->string('code', 100)->unique()->comment('รหัสคูปอง');
            $table->integer('cost')->default(0);
            $table->enum('status', ['Active', 'Used', 'Expired'])->default('Active')->index();
            $table->timestamp('used_at')->nullable();
            $table->string('used_by', 100)->nullable()->comment('admin ที่ใช้คูปอง');
            $table->timestamps();

            $table->foreign('username')->references('username')->on('users')->onDelete('cascade');
        });

        // ประวัติ Points
        Schema::create('points_transactions', function (Blueprint $table) {
            $table->id();
            $table->string('username', 100)->index();
            $table->string('type', 50)->index()->comment('quiz_pass, check_in, spin, redeem_coupon, etc.');
            $table->text('description')->nullable();
            $table->integer('points')->comment('บวก = ได้รับ, ลบ = ใช้ไป');
            $table->string('ref_id', 100)->nullable()->comment('quiz_log_id, coupon_id, etc.');
            $table->timestamps();

            $table->foreign('username')->references('username')->on('users')->onDelete('cascade');
        });

        // ประวัติการหมุนวงล้อ Lucky Wheel
        Schema::create('spin_transactions', function (Blueprint $table) {
            $table->id();
            $table->string('username', 100)->index();
            $table->integer('points_spent')->default(0);
            $table->integer('points_won')->default(0);
            $table->string('prize_label', 100)->nullable();
            $table->timestamps();

            $table->foreign('username')->references('username')->on('users')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('spin_transactions');
        Schema::dropIfExists('points_transactions');
        Schema::dropIfExists('coupons');
        Schema::dropIfExists('products');
    }
};
