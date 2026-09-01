<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class QuizLog extends Model
{
    protected $fillable = [
        'username', 'source_id', 'base_id', 'activity_id', 'attendance_type', 'score', 'status', 'cert_url',
    ];

    protected $casts = [
        'score' => 'float',
    ];
}
