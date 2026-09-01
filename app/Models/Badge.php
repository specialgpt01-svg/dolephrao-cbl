<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Badge extends Model
{
    protected $fillable = [
        'badge_key', 'name', 'description', 'image_url',
        'condition_type', 'condition_value',
    ];

    protected $casts = ['condition_value' => 'integer'];
}
