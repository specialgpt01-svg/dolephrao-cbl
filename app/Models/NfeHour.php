<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NfeHour extends Model
{
    protected $fillable = [
        'username', 'hours', 'points_spent', 'status',
        'note', 'reviewed_at', 'reviewed_by',
    ];

    protected $casts = [
        'hours'       => 'float',
        'points_spent' => 'integer',
        'reviewed_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'username', 'username');
    }
}
