<?php

namespace App\Models;

use App\Support\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Guardian extends Model
{
    use BelongsToSchool;

    protected $table = 'parents';

    protected $fillable = [
        'school_id', 'user_id', 'father_name', 'mother_name', 'guardian_name',
        'relationship', 'phone', 'email', 'address', 'occupation',
    ];

    public function school(): BelongsTo
    {
        return $this->belongsTo(School::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function students(): BelongsToMany
    {
        return $this->belongsToMany(Student::class, 'student_parents', 'parent_id', 'student_id')
            ->withPivot(['relationship', 'is_primary']);
    }

    public function displayName(): string
    {
        return $this->guardian_name
            ?? $this->father_name
            ?? $this->mother_name
            ?? $this->email
            ?? 'Guardian';
    }
}
