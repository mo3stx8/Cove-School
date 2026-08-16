<?php

namespace App\Services;

use App\Enums\UserStatus;
use App\Models\School;
use App\Models\Teacher;
use App\Models\User;
use App\Support\AuditLogger;
use App\Support\NumberGenerator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Spatie\Permission\PermissionRegistrar;

class TeacherService
{
    public function __construct(private readonly ActivationService $activation) {}

    public function create(array $data, School $school, User $actor): Teacher
    {
        return DB::transaction(function () use ($data, $school) {
            $user = User::create([
                'school_id' => $school->id,
                'name' => $data['name'],
                'system_email' => $data['system_email'],
                'email' => $data['email'],
                'phone' => $data['phone'] ?? null,
                'password' => Str::random(32),
                'locale' => 'en',
                'status' => UserStatus::Invited,
            ]);

            $registrar = app(PermissionRegistrar::class);
            $registrar->setPermissionsTeamId($school->id);
            $user->assignRole('teacher');

            $this->activation->invite($user, $data['email']);

            $teacher = $school->teachers()->create([
                'user_id' => $user->id,
                'employee_id' => $data['employee_id'] ?? NumberGenerator::employeeId($school->id),
                'qualification' => $data['qualification'] ?? null,
                'specialization' => $data['specialization'] ?? null,
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
