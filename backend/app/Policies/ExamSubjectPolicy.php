<?php

namespace App\Policies;

use App\Models\ExamSubject;
use App\Models\User;

class ExamSubjectPolicy
{
    public function view(User $user, ?ExamSubject $examSubject = null): bool
    {
        if (! $user->isStaff()) {
            return false;
        }

        if ($examSubject && $examSubject->teacher_id === $user->id) {
            return true;
        }

        return $user->hasPermissionTo('exams.view');
    }

    public function enterGrades(User $user, ExamSubject $examSubject): bool
    {
        if ($user->hasPermissionTo('grades.enter') && $examSubject->teacher_id === $user->id) {
            return true;
        }

        return $user->hasPermissionTo('grades.enter')
            && $user->hasPermissionTo('exams.update');
    }

    public function review(User $user, ExamSubject $examSubject): bool
    {
        return $user->hasPermissionTo('grades.review');
    }

    public function publish(User $user, ExamSubject $examSubject): bool
    {
        return $user->hasPermissionTo('grades.publish');
    }

    public function correct(User $user, ExamSubject $examSubject): bool
    {
        return $user->hasPermissionTo('grades.correct')
            || $user->hasPermissionTo('grades.review')
            || $user->hasPermissionTo('grades.publish');
    }
}
