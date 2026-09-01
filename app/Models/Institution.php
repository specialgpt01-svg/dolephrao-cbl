<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Institution extends Model
{
    use HasFactory;

    protected $table = 'institutions';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'code',
        'name',
        'province',
        'district',
        'sub_units',
        'logo_url',
        'theme_color',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'sub_units' => 'array',
    ];

    public function users(): HasMany
    {
        return $this->hasMany(User::class, 'institution_id', 'id');
    }

    public function sources(): HasMany
    {
        return $this->hasMany(Source::class, 'institution_id', 'id');
    }

    public function idPlans(): HasMany
    {
        return $this->hasMany(IdPlan::class, 'institution_id', 'id');
    }

    public function activities(): HasMany
    {
        return $this->hasMany(Activity::class, 'institution_id', 'id');
    }

    public function toArray(): array
    {
        return [
            'id'         => $this->id,
            'code'       => $this->code,
            'name'       => $this->name,
            'province'   => $this->province,
            'district'   => $this->district,
            'subUnits'   => $this->sub_units ?? [],
            'sub_units'  => $this->sub_units ?? [],
            'logoUrl'    => $this->logo_url ?? '',
            'themeColor' => $this->theme_color ?? '#059669',
            'isActive'   => (bool) $this->is_active,
        ];
    }
}
