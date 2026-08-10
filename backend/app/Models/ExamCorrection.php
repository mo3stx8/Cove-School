<?php

namespace App\Models;

use App\Enums\CorrectionStatus;
use App\Support\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ExamCorrection extends Model
{
    use BelongsToSchool;

    protected $fillable = [
        'school_id', 'exam_result_id', 'requested_by', 'old_marks', 'new_marks',
        'reason', 'status', 'reviewed_by', 'reviewed_at',
    ];

    protected function casts(): array
    {
        return [
            'old_marks' => 'float',
            'new_marks' => 'float',
            'status' => CorrectionStatus::class,
            'reviewed_at' => 'datetime',
        ];
    }

    public function examResult(): BelongsTo
    {
        return $this->belongsTo(ExamResult::class);
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
