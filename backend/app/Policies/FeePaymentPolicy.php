<?php

namespace App\Policies;

use App\Models\FeePayment;
use App\Models\User;

class FeePaymentPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasAnyPermission(['payments.view', 'payments.create', 'fees.view', 'reports.view'])
            || $user->hasRole('accountant');
    }

    public function view(User $user, ?FeePayment $payment = null): bool
    {
        if ($payment && $user->student && $user->student->id === $payment->student_id) {
            return true;
        }

        return $user->hasPermissionTo('payments.view');
    }

    public function create(User $user): bool
    {
        return $user->hasPermissionTo('payments.create');
    }
}
