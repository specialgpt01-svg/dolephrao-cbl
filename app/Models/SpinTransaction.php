<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SpinTransaction extends Model
{
    protected $fillable = ['username', 'points_spent', 'points_won', 'prize_label'];
    protected $casts    = ['points_spent' => 'integer', 'points_won' => 'integer'];
}
