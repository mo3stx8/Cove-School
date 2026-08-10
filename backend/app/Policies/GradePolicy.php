<?php

namespace App\Policies;

use App\Models\Grade;
use App\Models\User;

class GradePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasAnyPermission(['classes.view', 'students.view', 'settings.manage', 'grades.view']);
    }

    public function view(User $user, ?Grade $grade = null): bool
    {
        return $this->viewAny($user);
    }

    public function create(User $user): bool
    {
        return $user->hasPermissionTo('grades.create') || $user->hasPermissionTo('settings.manage');
    }

    public function update(User $user, Grade $grade): bool
    {
        return $user->hasPermissionTo('grades.update') || $user->hasPermissionTo('settings.manage');
    }
}
