<?php

namespace App\Policies;

use App\Models\Guardian;
use App\Models\User;

class GuardianPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermissionTo('guardians.view');
    }

    public function view(User $user, ?Guardian $guardian = null): bool
    {
        if ($guardian && $guardian->user_id === $user->id) {
            return true;
        }

        return $user->hasPermissionTo('guardians.view');
    }

    public function create(User $user): bool
    {
        return $user->hasPermissionTo('guardians.create');
    }

    public function update(User $user, Guardian $guardian): bool
    {
        if ($guardian->user_id === $user->id) {
            return true;
        }

        return $user->hasPermissionTo('guardians.update');
    }
}
