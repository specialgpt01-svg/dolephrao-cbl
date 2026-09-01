<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UpskillLearningLog extends Model
{
    protected $table    = 'upskill_learning_logs';
    protected $fillable = [
        'username', 'video_id', 'video_title', 'category_id', 'content',
        'status', 'grade', 'feedback', 'graded_at', 'graded_by',
    ];
    protected $casts    = ['grade' => 'float', 'graded_at' => 'datetime'];

    public function user()
    {
        return $this->belongsTo(User::class, 'username', 'username');
    }
}
