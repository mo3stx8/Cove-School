<?php

namespace App\Models;

use App\Support\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Teacher extends Model
{
    use BelongsToSchool;

    protected $fillable = [
        'school_id', 'user_id', 'employee_id', 'qualification', 'specialization', 'joining_date',
        'leaving_date', 'status', 'address',
    ];

    protected function casts(): array
    {
        return [
            'joining_date' => 'date',
            'leaving_date' => 'date',
        ];
    }

    public function school(): BelongsTo
    {
        return $this->belongsTo(School::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function classSubjects(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(ClassSubject::class, 'teacher_id', 'user_id');
    }
}
