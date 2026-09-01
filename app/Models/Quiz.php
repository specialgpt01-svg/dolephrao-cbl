<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Quiz extends Model
{
    protected $fillable = [
        'source_id', 'base_id', 'quiz_type', 'question', 'choices', 'answer', 'display_order',
    ];

    protected $casts = [
        'choices'       => 'array',
        'display_order' => 'integer',
    ];

    protected $hidden = ['answer']; // ซ่อน answer จาก Frontend

    public function toPublicArray(): array
    {
        return [
            'id'           => $this->id,
            'quizType'     => $this->quiz_type ?? 'posttest',
            'question'     => $this->question,
            'choices'      => $this->choices,
            'displayOrder' => (int) $this->display_order,
        ];
    }

    public function toAdminArray(): array
    {
        $choices = $this->choices ?? [];
        // รองรับทั้ง array และ JSON string
        if (is_string($choices)) {
            $choices = json_decode($choices, true) ?? [];
        }
        return [
            'quizId'       => (string) $this->id,
            'id'           => $this->id,
            'sourceId'     => $this->source_id,
            'baseId'       => $this->base_id,
            'quizType'     => $this->quiz_type ?? 'posttest',
            'question'     => $this->question,
            'choices'      => $choices,
            'choiceA'      => $choices[0] ?? '',
            'choiceB'      => $choices[1] ?? '',
            'choiceC'      => $choices[2] ?? '',
            'choiceD'      => $choices[3] ?? '',
            'answer'       => $this->answer,
            'displayOrder' => (int) $this->display_order,
        ];
    }

}
