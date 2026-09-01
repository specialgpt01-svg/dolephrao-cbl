<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class HomeFeatured extends Model
{
    protected $table = 'home_featured';

    protected $fillable = [
        'featured_id', 'institution_id', 'title', 'image_url', 'location_name', 'map_link',
        'start_date', 'end_date', 'short_desc', 'is_active',
    ];

    protected $casts = ['is_active' => 'boolean'];
}
