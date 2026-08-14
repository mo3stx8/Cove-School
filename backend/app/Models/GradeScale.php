<?php

namespace App\Models;

use App\Support\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GradeScale extends Model
{
    use BelongsToSchool;

    protected $fillable = ['school_id', 'name', 'min_percentage', 'max_percentage', 'points', 'color', 'is_default'];

    protected function casts(): array
    {
        return ['is_default' => 'boolean'];
    }

    public function school(): BelongsTo
    {
        return $this->belongsTo(School::class);
    }

    /**
     * Resolve the grade for a percentage using the school's default scale.
     */
    public static function gradeFor(int $schoolId, float $percentage): ?GradeScale
    {
        return static::forSchool($schoolId)
            ->whereRaw('min_percentage::numeric <= ?', [$percentage])
            ->whereRaw('max_percentage::numeric >= ?', [$percentage])
            ->orderBy('min_percentage')
            ->first();
    }
}
