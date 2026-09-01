<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SourceCheckIn extends Model
{
    protected $fillable = ['username', 'source_id', 'points'];
    protected $casts    = ['points' => 'integer'];
}
