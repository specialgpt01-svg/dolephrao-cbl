<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class IdPlanItem extends Model
{
    use HasFactory;

    protected $table = 'id_plan_items';

    protected $fillable = [
        'id_plan_id',
        'category',
        'source_id',
        'base_id',
        'activity_id',
        'custom_item_title',
        'assigned_sage_username',
        'target_hours',
        'completed_hours',
        'status',
        'sage_approved',
        'sage_approved_at',
        'sage_note',
    ];

    protected $casts = [
        'target_hours' => 'float',
        'completed_hours' => 'float',
        'sage_approved' => 'boolean',
        'sage_approved_at' => 'datetime',
    ];

    public function idPlan(): BelongsTo
    {
        return $this->belongsTo(IdPlan::class, 'id_plan_id', 'id');
    }

    public function source(): BelongsTo
    {
        return $this->belongsTo(Source::class, 'source_id', 'id');
    }

    public function base(): BelongsTo
    {
        return $this->belongsTo(Base::class, 'base_id', 'id');
    }

    public function activity(): BelongsTo
    {
        return $this->belongsTo(Activity::class, 'activity_id', 'id');
    }

    public function sage(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_sage_username', 'username');
    }
}
