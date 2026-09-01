<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PointsTransaction extends Model
{
    protected $fillable = [
        'username', 'type', 'description', 'points', 'ref_id',
    ];

    protected $casts = ['points' => 'integer'];
}
