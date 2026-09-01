<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserBadge extends Model
{
    protected $fillable = ['username', 'badge_key', 'earned_at'];
    protected $casts    = ['earned_at' => 'datetime'];

    public function badge(): BelongsTo
    {
        return $this->belongsTo(Badge::class, 'badge_key', 'badge_key');
    }
}
