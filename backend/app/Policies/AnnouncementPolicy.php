<?php

namespace App\Policies;

use App\Models\Announcement;
use App\Models\User;

class AnnouncementPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, ?Announcement $announcement = null): bool
    {
        if ($announcement) {
            if ($announcement->audience->value === 'everyone') {
                return true;
            }

            if ($announcement->audience->value === 'class') {
                return $user->student && $user->student->class_id === $announcement->class_id;
            }
        }

        return $user->hasPermissionTo('announcements.view');
    }

    public function create(User $user): bool
    {
        return $user->hasPermissionTo('announcements.create');
    }
}
