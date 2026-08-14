<?php

namespace App\Policies;

use App\Models\Assignment;
use App\Models\User;

class AssignmentPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermissionTo('assignments.view') || $user->hasRole('teacher');
    }

    public function view(User $user, ?Assignment $assignment = null): bool
    {
        if (! $user->isStaff()) {
            if ($assignment === null) {
                return false;
            }

            $classIds = $user->hasRole('parent')
                ? $user->guardians()->with('students:id,class_id')->get()
                    ->flatMap(fn ($g) => $g->students->pluck('class_id'))
                    ->filter()
                : collect([$user->student?->class_id])->filter();

            return $classIds->contains($assignment->class_id);
        }

        if ($assignment && $assignment->teacher_id === $user->id) {
            return true;
        }

        if ($assignment && $assignment->class?->classSubjects()->where('teacher_id', $user->id)->exists()) {
            return true;
        }

        return $user->hasPermissionTo('assignments.view');
    }

    public function create(User $user, ?Assignment $assignment = null): bool
    {
        return $user->hasPermissionTo('assignments.create');
    }

    public function update(User $user, Assignment $assignment): bool
    {
        return $user->hasPermissionTo('assignments.create')
            || ($user->hasRole('teacher') && $assignment->teacher_id === $user->id);
    }

    public function grade(User $user, Assignment $assignment): bool
    {
        return $user->hasPermissionTo('assignments.grade') && $assignment->teacher_id === $user->id;
    }
}
