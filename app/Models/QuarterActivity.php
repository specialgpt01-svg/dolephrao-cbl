<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class QuarterActivity extends Model
{
    protected $primaryKey = 'id';
    public $incrementing  = false;
    protected $keyType    = 'string';

    protected $fillable = [
        'id', 'institution_id', 'activity_name', 'description', 'image_url', 'location_name',
        'tambon', 'quarter', 'year', 'status', 'display_order',
        'learning_materials', 'external_links', 'video_url', 'is_online_enabled', 'online_description',
    ];

    protected $casts = [
        'quarter'            => 'integer',
        'year'               => 'integer',
        'display_order'      => 'integer',
        'learning_materials' => 'array',
        'external_links'     => 'array',
        'is_online_enabled'  => 'boolean',
    ];
}
