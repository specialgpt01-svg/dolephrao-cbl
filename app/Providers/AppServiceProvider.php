<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     *
     * @return void
     */
    public function register()
    {
        //
    }

    /**
     * Bootstrap any application services.
     *
     * @return void
     */
    public function boot()
    {
        // Self-healing schema upgrade for columns on shared hosting environments
        try {
            if (\Illuminate\Support\Facades\Schema::hasTable('users')) {
                \Illuminate\Support\Facades\DB::statement("ALTER TABLE `users` MODIFY COLUMN `profile_image` LONGTEXT NULL");
            }
            if (\Illuminate\Support\Facades\Schema::hasTable('learning_sources')) {
                \Illuminate\Support\Facades\DB::statement("ALTER TABLE `learning_sources` MODIFY COLUMN `cover_image` LONGTEXT NULL");
                \Illuminate\Support\Facades\DB::statement("ALTER TABLE `learning_sources` MODIFY COLUMN `qr_image` LONGTEXT NULL");
            }
            if (\Illuminate\Support\Facades\Schema::hasTable('activities')) {
                \Illuminate\Support\Facades\DB::statement("ALTER TABLE `activities` MODIFY COLUMN `image_url` LONGTEXT NULL");
            }
            if (\Illuminate\Support\Facades\Schema::hasTable('coupons')) {
                \Illuminate\Support\Facades\DB::statement("ALTER TABLE `coupons` MODIFY COLUMN `image` LONGTEXT NULL");
            }
        } catch (\Throwable $e) {
            // Silently ignore if already modified or not supported
        }
    }
}
