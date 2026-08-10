<?php

namespace App\Policies;

use App\Models\Timetable;
use App\Models\User;

class TimetablePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasAnyPermission(['timetables.view', 'classes.view'])
            || $user->hasRole('teacher');
    }

    public function view(User $user, Timetable $timetable): bool
    {
        if ($timetable->class?->class_teacher_id === $user->id) {
            return true;
        }

        return $this->viewAny($user);
    }

    public function manage(User $user): bool
    {
        return $user->hasPermissionTo('timetables.manage');
    }
}
