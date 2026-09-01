<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UpskillProgress extends Model
{
    protected $fillable = ['username', 'video_id', 'progress_seconds', 'completed'];
    protected $casts = ['progress_seconds' => 'integer', 'completed' => 'boolean'];
}
