<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ActivityEvaluation extends Model
{
    protected $fillable = [
        'activity_id',
        'activity_name',
        'username',
        'ratings',
        'overall_score',
        'feedback_impressions',
        'feedback_suggestions',
        'feedback_future_topics',
        'gender',
        'age_group',
        'occupation',
        'tambon',
    ];

    protected $casts = [
        'ratings'       => 'array',
        'overall_score' => 'float',
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'username', 'username');
    }

    public function activity()
    {
        return $this->belongsTo(Activity::class, 'activity_id', 'id');
    }
}
