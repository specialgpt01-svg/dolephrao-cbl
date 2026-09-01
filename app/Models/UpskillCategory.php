<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UpskillCategory extends Model
{
    protected $fillable = ['external_id', 'name', 'icon', 'color', 'description', 'image_url', 'display_order', 'is_active'];
    protected $casts = ['display_order' => 'integer', 'is_active' => 'boolean'];
}
