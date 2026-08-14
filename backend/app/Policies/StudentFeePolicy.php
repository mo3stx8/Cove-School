<?php

namespace App\Policies;

use App\Models\StudentFee;
use App\Models\User;

class StudentFeePolicy
{
    public function viewAny(User $user): bool
    {
        if ($user->hasRole('parent')) {
            return true;
        }

        if ($user->hasRole('student')) {
            return false;
        }

        return $user->hasAnyPermission(['fees.view', 'fees.create', 'fees.update', 'payments.view', 'payments.create', 'reports.view'])
            || $user->hasRole('accountant');
    }

    public function view(User $user, ?StudentFee $studentFee = null): bool
    {
        if ($user->hasRole('student')) {
            return false;
        }

        if ($user->hasRole('parent')) {
            return $studentFee !== null
                && $user->guardians()->whereHas('students', fn ($q) => $q->where('students.id', $studentFee->student_id))->exists();
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
