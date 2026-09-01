<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Source extends Model
{
    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id', 'institution_id', 'name', 'tambon', 'cover_image', 'latitude', 'longitude',
        'description', 'subject_category', 'credit_hours', 'views',
        'info', 'cert_template', 'cert_template_id',
    ];

    protected $casts = [
        'credit_hours' => 'float',
        'views'        => 'integer',
        'info'         => 'array',
        'cert_template' => 'array',
    ];

    public function bases(): HasMany
    {
        return $this->hasMany(Base::class, 'source_id', 'id')
            ->orderBy('display_order');
    }

    public function quizzes(): HasMany
    {
        return $this->hasMany(Quiz::class, 'source_id', 'id')
            ->orderBy('display_order');
    }

    public function toListArray(): array
    {
        $bases = $this->bases->map(fn($b) => $b->toSummaryArray())->values()->toArray();
        return [
            'SourceID'       => $this->id,
            'SourceName'     => $this->name,
            'TambonName'     => $this->tambon,
            'institutionId'  => $this->institution_id ?? 'INS_PHRAO',
            'institution_id' => $this->institution_id ?? 'INS_PHRAO',
            'CoverImageURL'  => $this->cover_image ?? '',
            'CoverImage'     => $this->cover_image ?? '',
            'coverPosition'  => $this->info['cover_position'] ?? '50% 50%',
            'cover_position' => $this->info['cover_position'] ?? '50% 50%',
            'Latitude'       => $this->latitude ?? '',
            'Longitude'      => $this->longitude ?? '',
            'Description'    => $this->description ?? '',
            'info'           => is_array($this->info) ? $this->info : [],
            'evaluation'     => $this->info['evaluation'] ?? null,
            'facilities'     => $this->info['facilities'] ?? null,
            'sourceType'     => $this->info['source_type'] ?? '',
            'subjectCategory' => $this->subject_category ?? '',
            'address'        => $this->info['address'] ?? '',
            'openingHours'   => $this->info['opening_hours'] ?? '',
            'managerName'    => $this->info['manager_name'] ?? '',
            'networkPartners'=> $this->info['network_partners'] ?? '',
            'operationPlan'  => $this->info['operation_plan'] ?? '',
            'wisdomExpertName' => $this->info['wisdom_expert_name'] ?? '',
            'expertSpecialty'=> $this->info['expert_specialty'] ?? '',
            'learningMedia'  => $this->info['learning_media'] ?? '',
            'targetLearners' => $this->info['target_learners'] ?? '',
            'assessmentTools'=> $this->info['assessment_tools'] ?? '',
            'followupPlan'   => $this->info['followup_plan'] ?? '',
            'views'          => (int) $this->views,
            'creditHours'    => (float) $this->credit_hours,
            'baseCount'      => count($bases),
            'bases'          => $bases,
            '_summaryOnly'   => true,
        ];
    }

    public function toDetailArray(): array
    {
        $arr = $this->toListArray();
        $arr['bases'] = $this->bases->map(function (Base $base) {
            $data = $base->toAdminArray();
            $allQuizzes = $base->quizzes->map(fn (Quiz $quiz) => $quiz->toAdminArray())->values();
            $pretest = $allQuizzes->filter(fn ($q) => ($q['quizType'] ?? 'posttest') === 'pretest')->values()->toArray();
            $posttest = $allQuizzes->filter(fn ($q) => ($q['quizType'] ?? 'posttest') === 'posttest')->values()->toArray();
            
            if (empty($pretest) && !empty($posttest)) {
                $pretest = array_reverse($posttest);
            }
            if (empty($posttest) && !empty($pretest)) {
                $posttest = array_reverse($pretest);
            }

            $data['quizzes'] = $posttest;
            $data['pretestQuizzes'] = $pretest;
            return $data;
        })->values()->toArray();
        $arr['quizzes'] = $this->quizzes
            ->whereNull('base_id')
            ->map(fn (Quiz $quiz) => $quiz->toAdminArray())
            ->values()
            ->toArray();
        $arr['_summaryOnly'] = false;
        $arr['_detailLoaded'] = true;
        return $arr;
    }
}
