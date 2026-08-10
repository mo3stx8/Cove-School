<?php

namespace App\Models;

use App\Enums\StudentStatus;
use App\Support\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Student extends Model
{
    use BelongsToSchool, SoftDeletes;

    protected $fillable = [
        'school_id', 'user_id', 'student_number', 'admission_number', 'first_name',
        'middle_name', 'last_name', 'date_of_birth', 'gender', 'nationality',
        'photo', 'address', 'status', 'enrollment_date', 'class_id',
        'emergency_contact_name', 'emergency_contact_relationship',
        'emergency_contact_phone', 'medical_notes',
    ];

    protected function casts(): array
    {
        return [
            'date_of_birth' => 'date',
            'enrollment_date' => 'date',
            'status' => StudentStatus::class,
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

    public function class(): BelongsTo
    {
        return $this->belongsTo(SchoolClass::class, 'class_id');
    }

    public function guardians(): BelongsToMany
    {
        return $this->belongsToMany(Guardian::class, 'student_parents', 'student_id', 'parent_id')
            ->withPivot(['relationship', 'is_primary']);
    }

    public function documents(): HasMany
    {
        return $this->hasMany(StudentDocument::class);
    }

    public function attendanceRecords(): HasMany
    {
        return $this->hasMany(AttendanceRecord::class);
    }

    public function examResults(): HasMany
    {
        return $this->hasMany(ExamResult::class);
    }

    public function studentFees(): HasMany
    {
        return $this->hasMany(StudentFee::class);
    }

    public function submissions(): HasMany
    {
        return $this->hasMany(AssignmentSubmission::class);
    }

    public function fullName(): string
    {
        return trim(implode(' ', array_filter([
            $this->first_name,
            $this->middle_name,
            $this->last_name,
        ])));
    }

    public function attendanceRate(?string $start = null, ?string $end = null): float
    {
        $records = $this->attendanceRecords()->whereHas('session', function ($q) use ($start, $end) {
            $q->when($start, fn ($b) => $b->where('date', '>=', $start))
                ->when($end, fn ($b) => $b->where('date', '<=', $end));
        })->get();

        $total = $records->count();

        if ($total === 0) {
            return 0;
        }

        $present = $records->where('status', \App\Enums\AttendanceStatus::Present->value)->count()
            + $records->where('status', \App\Enums\AttendanceStatus::Late->value)->count();

        return round(($present / $total) * 100, 2);
    }
}
