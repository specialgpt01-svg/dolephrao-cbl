<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LearningLog extends Model
{
    protected $fillable = [
        'log_id', 'username', 'activity_name', 'description', 'external_link',
        'status', 'score', 'note', 'reviewed_at', 'reviewed_by',
    ];

    protected $casts = [
        'score'       => 'float',
        'reviewed_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'username', 'username');
    }
}
