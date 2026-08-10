<?php

namespace App\Policies;

use App\Models\Teacher;
use App\Models\User;

class TeacherPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasAnyPermission(['teachers.view', 'teachers.create', 'teachers.update', 'teachers.archive']);
    }

    public function view(User $user, ?Teacher $teacher = null): bool
    {
        return $user->hasPermissionTo('teachers.view');
    }

    public function create(User $user): bool
    {
        return $user->hasPermissionTo('teachers.create');
    }

    public function update(User $user, Teacher $teacher): bool
    {
        return $user->hasPermissionTo('teachers.update');
    }

    public function archive(User $user, Teacher $teacher): bool
    {
        return $user->hasPermissionTo('teachers.archive');
    }
}
