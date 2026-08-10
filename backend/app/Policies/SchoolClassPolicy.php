<?php

namespace App\Policies;

use App\Models\SchoolClass;
use App\Models\User;

class SchoolClassPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasAnyPermission(['classes.view', 'attendance.view', 'timetables.view'])
            || $user->hasRole('teacher');
    }

    public function view(User $user, ?SchoolClass $class = null): bool
    {
        if ($class && $class->class_teacher_id === $user->id) {
            return true;
        }

        if ($class && $class->classSubjects()->where('teacher_id', $user->id)->exists()) {
            return true;
        }

        return $user->hasPermissionTo('classes.view');
    }

    public function create(User $user): bool
    {
        return $user->hasPermissionTo('classes.create');
    }

    public function update(User $user, SchoolClass $class): bool
    {
        return $user->hasPermissionTo('classes.update');
    }

    public function delete(User $user, SchoolClass $class): bool
    {
        return $user->hasPermissionTo('classes.delete');
    }
}
