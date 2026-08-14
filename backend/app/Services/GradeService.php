<?php

namespace App\Services;

use App\Models\GradeScale;

class GradeService
{
    /**
     * Resolve the grade for a given percentage using the school's scale.
     */
    public static function gradeFor(int $schoolId, float $percentage): ?GradeScale
    {
        return GradeScale::forSchool($schoolId)
            ->whereRaw('min_percentage::numeric <= ?', [$percentage])
            ->whereRaw('max_percentage::numeric >= ?', [$percentage])
            ->orderBy('min_percentage')
            ->first();
    }

    /**
     * Compute the percentage from marks.
     */
    public static function percentage(float $marks, float $fullMarks): float
    {
        if ($fullMarks <= 0) {
            return 0;
        }

        return round(($marks / $fullMarks) * 100, 2);
    }

    /**
     * Weighted average of percentages.
     */
    public static function average(array $percentages): float
    {
        if (empty($percentages)) {
            return 0;
        }

        return round(array_sum($percentages) / count($percentages), 2);
    }
}
