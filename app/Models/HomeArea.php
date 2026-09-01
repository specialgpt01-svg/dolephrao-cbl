<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class HomeArea extends Model
{
    protected $fillable = ['institution_id', 'areas'];
    protected $casts    = ['areas' => 'array'];
}
