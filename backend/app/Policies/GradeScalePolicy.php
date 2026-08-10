<?php

namespace App\Policies;

use App\Models\GradeScale;
use App\Models\User;

class GradeScalePolicy
{
    public function view(User $user, ?GradeScale $gradeScale = null): bool
    {
        return $user->hasAnyPermission(['settings.manage', 'grades.view', 'exams.view'])
            || $user->hasRole('teacher');
    }

    public function update(User $user, ?GradeScale $gradeScale = null): bool
    {
        return $user->hasPermissionTo('settings.manage');
    }
}
