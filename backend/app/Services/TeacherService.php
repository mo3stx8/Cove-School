<?php

namespace App\Services;

use App\Models\School;
use App\Models\Teacher;
use App\Models\User;
use App\Support\AuditLogger;
use App\Support\NumberGenerator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\PermissionRegistrar;

class TeacherService
{
    public function create(array $data, School $school, User $actor): Teacher
    {
        return DB::transaction(function () use ($data, $school) {
            $user = User::create([
                'school_id' => $school->id,
                'name' => $data['name'],
                'email' => $data['email'],
                'phone' => $data['phone'] ?? null,
                'password' => Hash::make($data['password'] ?? str()->random(12)),
                'locale' => 'en',
                'status' => 'active',
            ]);

            $registrar = app(PermissionRegistrar::class);
            $registrar->setPermissionsTeamId($school->id);
            $user->assignRole('teacher');

            $teacher = $school->teachers()->create([
                'user_id' => $user->id,
                'employee_id' => $data['employee_id'] ?? NumberGenerator::employeeId($school->id),
                'qualification' => $data['qualification'] ?? null,
                'joining_date' => $data['joining_date'] ?? null,
                'status' => 'active',
                'address' => $data['address'] ?? null,
            ]);

            AuditLogger::log('teacher.created', $teacher, null, $teacher->toArray());

            return $teacher;
        });
    }

    public function archive(Teacher $teacher, ?string $reason = null): Teacher
    {
        $teacher->update(['status' => 'archived', 'leaving_date' => now()->toDateString()]);
        AuditLogger::log('teacher.archived', $teacher, null, ['status' => 'archived'], $reason);

        return $teacher;
    }
}
