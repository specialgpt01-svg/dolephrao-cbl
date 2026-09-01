<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Base extends Model
{
    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id', 'source_id', 'name', 'description', 'cover_image',
        'video_url', 'display_order', 'is_active', 'info', 'cert_template',
    ];

    protected $casts = [
        'display_order' => 'integer',
        'is_active'     => 'boolean',
        'info'          => 'array',
        'cert_template' => 'array',
    ];

    public function source(): BelongsTo
    {
        return $this->belongsTo(Source::class, 'source_id', 'id');
    }

    public function quizzes(): HasMany
    {
        return $this->hasMany(Quiz::class, 'base_id', 'id')
            ->orderBy('display_order');
    }

    public function toSummaryArray(): array
    {
        return [
            'baseId'       => $this->id,
            'id'           => $this->id,
            'baseName'     => $this->name ?? '',
            'name'         => $this->name ?? '',
            'description'  => $this->description ?? '',
            'video_url'    => $this->video_url ?? '',
            'videoUrl'     => $this->video_url ?? '',
            'cover_image'  => $this->cover_image ?? '',
            'coverImage'   => $this->cover_image ?? '',
            'displayOrder' => (int) $this->display_order,
            'isActive'     => (bool) $this->is_active,
        ];
    }

    public function toAdminArray(): array
    {
        $info = $this->info ?? [];
        return [
            'baseId'              => $this->id,
            'sourceId'            => $this->source_id,
            'baseName'            => $this->name ?? '',
            'description'         => $this->description ?? '',
            'coverImage'          => $this->cover_image ?? '',
            'videoUrl'            => $this->video_url ?? '',
            'displayOrder'        => (int) $this->display_order,
            'isActive'            => (bool) $this->is_active,
            'history'             => $info['history'] ?? '',
            'result'              => $info['result'] ?? '',
            'contact'             => $info['contact'] ?? '',
            'gallery'             => $info['gallery'] ?? '',
            'external'            => $info['external'] ?? '',
            'gps'                 => $info['gps'] ?? '',
            'certificateTemplate' => $this->cert_template,
        ];
    }
}
