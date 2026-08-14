<?php

namespace App\Policies;

use App\Models\Guardian;
use App\Models\Student;
use App\Models\User;

class StudentPolicy
{
    public function viewAny(User $user): bool
    {
        if ($user->hasRole('student') || $user->hasRole('parent')) {
            return false;
        }

        return $user->hasAnyPermission([
            'students.view', 'students.create', 'students.update', 'students.archive',
            'attendance.view', 'attendance.take', 'fees.view', 'grades.enter',
            'payments.view', 'reports.view',
        ]) || $user->hasRole('teacher');
    }

    public function view(User $user, Student $student): bool
    {
        if ($user->student && $user->student->is($student)) {
            return true;
        }

        if (Guardian::where('user_id', $user->id)->whereHas('students', fn ($q) => $q->where('students.id', $student->id))->exists()) {
            return true;
        }

        if (! $user->isStaff()) {
            return false;
        }

        if ($user->hasAnyPermission(['students.view', 'students.update', 'students.archive'])) {
            return true;
        }

        $classSubject = $student->class?->classSubjects()->where('teacher_id', $user->id)->first();

        return $classSubject !== null;
    }

    public function create(User $user): bool
    {
        return $user->hasPermissionTo('students.create');
    }

    public function update(User $user, Student $student): bool
    {
        return $user->hasPermissionTo('students.update');
    }

    public function archive(User $user, Student $student): bool
    {
        return $user->hasPermissionTo('students.archive');
    }

    public function manageDocuments(User $user, Student $student): bool
    {
        return $user->hasPermissionTo('students.manage_documents');
    }
}
