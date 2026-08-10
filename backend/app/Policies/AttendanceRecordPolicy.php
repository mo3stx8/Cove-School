<?php

namespace App\Policies;

use App\Models\AttendanceRecord;
use App\Models\User;

class AttendanceRecordPolicy
{
    public function view(User $user, AttendanceRecord $record): bool
    {
        if ($user->hasPermissionTo('attendance.view')) {
            return true;
        }

        $student = $record->student;

        if ($user->student && $user->student->is($student)) {
            return true;
        }

        if ($user->id === $record->marked_by) {
            return true;
        }

        return false;
    }

    public function take(User $user): bool
    {
        return $user->hasPermissionTo('attendance.take');
    }

    public function correct(User $user, AttendanceRecord $record): bool
    {
        if ($user->hasPermissionTo('attendance.approve_corrections')) {
            return true;
        }

        return $user->hasPermissionTo('attendance.correct') && $user->id === $record->marked_by;
    }

    public function approveCorrections(User $user): bool
    {
        return $user->hasPermissionTo('attendance.approve_corrections');
    }
}
