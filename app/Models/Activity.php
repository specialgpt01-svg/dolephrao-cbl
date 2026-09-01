<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Activity extends Model
{
    protected $primaryKey = 'id';
    public $incrementing  = false;
    protected $keyType    = 'string';

    protected $fillable = [
        'id', 'institution_id', 'name', 'description', 'cover_image', 'location', 'event_date',
        'contact_name', 'contact_phone', 'tambon', 'status', 'is_featured', 'certificate_template',
        'quiz_ids', 'check_in_points', 'quiz_pass_score',
        'learning_materials', 'external_links', 'video_url', 'is_online_enabled', 'online_description',
    ];

    protected $casts = [
        'is_featured'        => 'boolean',
        'quiz_ids'           => 'array',
        'learning_materials' => 'array',
        'external_links'     => 'array',
        'is_online_enabled'  => 'boolean',
        'check_in_points'    => 'integer',
        'quiz_pass_score'    => 'integer',
    ];
}
