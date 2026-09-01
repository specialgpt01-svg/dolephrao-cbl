<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UpskillVideo extends Model
{
    protected $fillable = ['external_id', 'category_id', 'title', 'description', 'video_url', 'thumbnail_url', 'duration_seconds', 'display_order', 'is_active'];
    protected $casts = ['duration_seconds' => 'integer', 'display_order' => 'integer', 'is_active' => 'boolean'];
}
