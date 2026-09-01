<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Certificate extends Model
{
    protected $fillable = [
        'username', 'source_id', 'base_id', 'activity_id', 'attendance_type',
        'cert_no', 'cert_url', 'status', 'issued_at', 'revoked_at', 'revoked_by',
    ];

    protected $casts = [
        'issued_at'  => 'datetime',
        'revoked_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'username', 'username');
    }
}
