<?php

namespace App\Policies;

use App\Models\FeeType;
use App\Models\User;

class FeeTypePolicy
{
    public function view(User $user, ?FeeType $feeType = null): bool
    {
        return $user->hasAnyPermission(['fees.view', 'fees.create', 'fees.update', 'payments.view'])
            || $user->hasRole('accountant');
    }

    public function create(User $user): bool
    {
        return $user->hasPermissionTo('fees.create');
    }

    public function update(User $user, FeeType $feeType): bool
    {
        return $user->hasPermissionTo('fees.update');
    }
}
