<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ActivityCheckIn extends Model
{
    protected $fillable = ['username', 'activity_id', 'activity_name', 'points'];
    protected $casts    = ['points' => 'integer'];
}
