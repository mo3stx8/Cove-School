<?php

namespace App\Models;

use App\Support\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Assignment extends Model
{
    use BelongsToSchool;

    protected $fillable = [
        'school_id', 'class_id', 'subject_id', 'teacher_id', 'title',
        'description', 'due_date', 'due_time', 'status',
    ];

    protected function casts(): array
    {
        return [
            'due_date' => 'date:Y-m-d',
            'due_time' => 'datetime',
        ];
    }

    public function school(): BelongsTo
    {
        return $this->belongsTo(School::class);
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

    public function attachments(): HasMany
    {
        return $this->hasMany(AssignmentAttachment::class);
    }

    public function submissions(): HasMany
    {
        return $this->hasMany(AssignmentSubmission::class);
    }

    public function deadline(): \Illuminate\Support\Carbon
    {
        $day = $this->due_date instanceof \Illuminate\Support\Carbon ? $this->due_date->copy() : \Illuminate\Support\Carbon::parse($this->due_date);

        if ($this->due_time) {
            $time = $this->due_time instanceof \Illuminate\Support\Carbon ? $this->due_time : \Illuminate\Support\Carbon::parse($this->due_time);

            return $day->setTime((int) $time->format('H'), (int) $time->format('i'), (int) $time->format('s'));
        }

        return $day->endOfDay();
    }

    public function deadlinePassed(): bool
    {
        return now()->gt($this->deadline());
    }
}
