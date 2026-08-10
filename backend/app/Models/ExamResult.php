<?php

namespace App\Models;

use App\Enums\GradeStatus;
use App\Support\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ExamResult extends Model
{
    use BelongsToSchool;

    protected $fillable = ['exam_subject_id', 'student_id', 'marks', 'grade', 'remarks', 'status'];

    protected function casts(): array
    {
        return [
            'marks' => 'float',
            'status' => GradeStatus::class,
        ];
    }

    public function examSubject(): BelongsTo
    {
        return $this->belongsTo(ExamSubject::class);
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    public function corrections(): HasMany
    {
        return $this->hasMany(ExamCorrection::class);
    }

    public function percentage(float $fullMarks): float
    {
        return $fullMarks > 0 ? round(($this->marks / $fullMarks) * 100, 2) : 0;
    }
}
