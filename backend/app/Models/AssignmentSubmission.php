<?php

namespace App\Models;

use App\Support\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssignmentSubmission extends Model
{
    use BelongsToSchool;

    protected $fillable = [
        'assignment_id', 'student_id', 'text', 'file_name', 'file_path',
        'mime_type', 'size', 'submitted_at', 'grade', 'feedback', 'excuse', 'status',
    ];

    protected function casts(): array
    {
        return [
            'submitted_at' => 'datetime',
            'grade' => 'float',
        ];
    }

    public function assignment(): BelongsTo
    {
        return $this->belongsTo(Assignment::class);
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }
}
