<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Proposal extends Model
{
    protected $fillable = [
        'username', 'activity_id', 'title', 'description',
        'status', 'note', 'reviewed_at', 'reviewed_by',
        'evaluation_data', 'survey_data',
    ];

    protected $casts = [
        'reviewed_at'    => 'datetime',
        'evaluation_data' => 'array',
        'survey_data'    => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'username', 'username');
    }
}
