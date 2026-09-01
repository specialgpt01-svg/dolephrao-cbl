<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class IdPlan extends Model
{
    use HasFactory;

    protected $table = 'id_plans';

    protected $fillable = [
        'username',
        'institution_id',
        'teacher_username',
        'sage_username',
        'title',
        'target_career_goal',
        'initial_digital_level',
        'strengths_json',
        'gaps_json',
        'academic_target_hours',
        'vocation_target_hours',
        'digital_target_hours',
        'status',
        'inactivity_days_threshold',
        'last_activity_at',
        'target_completion_date',
    ];

    protected $casts = [
        'strengths_json' => 'array',
        'gaps_json' => 'array',
        'academic_target_hours' => 'float',
        'vocation_target_hours' => 'float',
        'digital_target_hours' => 'float',
        'inactivity_days_threshold' => 'integer',
        'last_activity_at' => 'datetime',
        'target_completion_date' => 'date',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'username', 'username');
    }

    public function teacher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'teacher_username', 'username');
    }

    public function sage(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sage_username', 'username');
    }

    public function items(): HasMany
    {
        return $this->hasMany(IdPlanItem::class, 'id_plan_id', 'id');
    }

    public function logs(): HasMany
    {
        return $this->hasMany(IdPlanLog::class, 'id_plan_id', 'id');
    }

    public function checkInactivityStatus(): string
    {
        if ($this->status === 'Completed') return 'Completed';
        
        $thresholdDays = $this->inactivity_days_threshold ?: 20;
        $lastActive = $this->last_activity_at ?: $this->updated_at;
        
        if ($lastActive && $lastActive->diffInDays(now()) >= $thresholdDays) {
            return 'InDanger';
        }
        return $this->status;
    }
}
