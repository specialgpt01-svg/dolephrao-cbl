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
        // Self-healing schema upgrade for users profile_image column on shared hosting
        try {
            if (\Illuminate\Support\Facades\Schema::hasTable('users')) {
                \Illuminate\Support\Facades\DB::statement("ALTER TABLE `users` MODIFY COLUMN `profile_image` LONGTEXT NULL");
            }
        } catch (\Throwable $e) {
            // Silently ignore if not MySQL or already modified
        }
    }
}
