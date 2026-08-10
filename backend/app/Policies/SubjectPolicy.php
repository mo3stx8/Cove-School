<?php

namespace App\Policies;

use App\Models\Subject;
use App\Models\User;

class SubjectPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasAnyPermission(['subjects.view', 'classes.view', 'timetables.view', 'settings.manage'])
            || $user->hasRole('teacher');
    }

    public function view(User $user, ?Subject $subject = null): bool
    {
        return $this->viewAny($user);
    }

    public function create(User $user): bool
    {
        return $user->hasPermissionTo('subjects.create') || $user->hasPermissionTo('settings.manage');
    }

    public function update(User $user, Subject $subject): bool
    {
        return $user->hasPermissionTo('subjects.update') || $user->hasPermissionTo('settings.manage');
    }
}
