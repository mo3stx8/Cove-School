<?php

namespace App\Policies;

use App\Models\StudentFee;
use App\Models\User;

class StudentFeePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasAnyPermission(['fees.view', 'fees.create', 'fees.update', 'payments.view', 'payments.create', 'reports.view'])
            || $user->hasRole('accountant');
    }

    public function view(User $user, ?StudentFee $studentFee = null): bool
    {
        if ($studentFee && $user->student && $user->student->id === $studentFee->student_id) {
            return true;
        }

        if ($studentFee && $user->guardians()->whereHas('students', fn ($q) => $q->where('students.id', $studentFee->student_id))->exists()) {
            return true;
        }

        return $user->hasPermissionTo('fees.view');
    }

    public function create(User $user): bool
    {
        return $user->hasPermissionTo('fees.create');
    }

    public function update(User $user, StudentFee $studentFee): bool
    {
        return $user->hasPermissionTo('fees.update');
    }
}
