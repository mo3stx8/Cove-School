<?php

namespace App\Policies;

use App\Models\Exam;
use App\Models\User;

class ExamPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasAnyPermission(['exams.view', 'exams.create', 'exams.update', 'grades.enter'])
            || $user->hasRole('teacher');
    }

    public function view(User $user, Exam $exam): bool
    {
        if ($exam->examSubjects()->where('teacher_id', $user->id)->exists()) {
            return true;
        }

        return $user->hasPermissionTo('exams.view');
    }

    public function create(User $user): bool
    {
        return $user->hasPermissionTo('exams.create');
    }

    public function update(User $user, Exam $exam): bool
    {
        return $user->hasPermissionTo('exams.update');
    }
}
