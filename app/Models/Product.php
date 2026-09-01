<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Product extends Model
{
    protected $fillable = [
        'external_id', 'name', 'category', 'description', 'contact', 'district', 'tambon',
        'image_url', 'images', 'cost', 'price', 'stock', 'is_active',
    ];

    protected $casts = [
        'cost'      => 'integer',
        'stock'     => 'integer',
        'is_active' => 'boolean',
        'images'    => 'array',
    ];
}
