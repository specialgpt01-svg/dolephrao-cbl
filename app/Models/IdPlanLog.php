<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class IdPlanLog extends Model
{
    use HasFactory;

    protected $table = 'id_plan_logs';

    protected $fillable = [
        'id_plan_id',
        'visit_date',
        'visited_by',
        'reason_for_inactivity',
        'action_taken',
        'new_completion_date',
    ];

    protected $casts = [
        'visit_date' => 'date',
        'new_completion_date' => 'date',
    ];

    public function idPlan(): BelongsTo
    {
        return $this->belongsTo(IdPlan::class, 'id_plan_id', 'id');
    }

    public function visitor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'visited_by', 'username');
    }
}
