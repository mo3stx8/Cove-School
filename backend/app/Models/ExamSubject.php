<?php

namespace App\Models;

use App\Enums\GradeStatus;
use App\Support\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ExamSubject extends Model
{
    use BelongsToSchool;

    protected $fillable = [
        'exam_id', 'class_id', 'subject_id', 'teacher_id', 'full_marks',
        'pass_marks', 'status',
    ];

    protected function casts(): array
    {
        return ['status' => GradeStatus::class];
    }

    public function exam(): BelongsTo
    {
        return $this->belongsTo(Exam::class);
    }

    public function class(): BelongsTo
    {
        return $this->belongsTo(SchoolClass::class, 'class_id');
    }

    public function subject(): BelongsTo
    {
        return $this->belongsTo(Subject::class);
    }

    public function teacher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'teacher_id');
    }

    public function results(): HasMany
    {
        return $this->hasMany(ExamResult::class);
    }
}
