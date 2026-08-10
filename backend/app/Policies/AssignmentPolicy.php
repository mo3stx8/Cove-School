<?php

namespace App\Policies;

use App\Models\Assignment;
use App\Models\User;

class AssignmentPolicy
{
    public function view(User $user, ?Assignment $assignment = null): bool
    {
        if ($assignment && $assignment->teacher_id === $user->id) {
            return true;
        }

        if ($assignment && $assignment->class?->classSubjects()->where('teacher_id', $user->id)->exists()) {
            return true;
        }

        if ($assignment && $user->student && $user->student->class_id === $assignment->class_id) {
            return true;
        }

        return $user->hasPermissionTo('assignments.view');
    }

    public function create(User $user, ?Assignment $assignment = null): bool
    {
        return $user->hasPermissionTo('assignments.create');
    }

    public function grade(User $user, Assignment $assignment): bool
    {
        return $user->hasPermissionTo('assignments.grade') && $assignment->teacher_id === $user->id;
    }
}
