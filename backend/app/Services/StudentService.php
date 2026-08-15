<?php

namespace App\Services;

use App\Enums\UserStatus;
use App\Models\Guardian;
use App\Models\School;
use App\Models\Student;
use App\Models\User;
use App\Support\AuditLogger;
use App\Support\NumberGenerator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Spatie\Permission\PermissionRegistrar;

class StudentService
{
    public function __construct(private readonly ActivationService $activation) {}

    public function enroll(array $data, School $school, User $actor): Student
    {
        return DB::transaction(function () use ($data, $school) {
            $studentUser = $this->createStudentUser($data, $school);

            $student = $school->students()->create([
                'user_id' => $studentUser?->id,
                'student_number' => NumberGenerator::studentNumber($school->id),
                'admission_number' => NumberGenerator::admissionNumber($school->id),
                'first_name' => $data['first_name'],
                'middle_name' => $data['middle_name'] ?? null,
                'last_name' => $data['last_name'],
                'date_of_birth' => $data['date_of_birth'] ?? null,
                'gender' => $data['gender'] ?? null,
                'nationality' => $data['nationality'] ?? null,
                'address' => $data['address'] ?? null,
                'photo' => $data['photo'] ?? null,
                'status' => 'active',
                'enrollment_date' => $data['enrollment_date'] ?? now()->toDateString(),
                'class_id' => $data['class_id'] ?? null,
                'emergency_contact_name' => $data['emergency_contact_name'] ?? null,
                'emergency_contact_relationship' => $data['emergency_contact_relationship'] ?? null,
                'emergency_contact_phone' => $data['emergency_contact_phone'] ?? null,
                'medical_notes' => $data['medical_notes'] ?? null,
            ]);

            $guardianBatches = [
                'father' => $data['father'] ?? null,
                'mother' => $data['mother'] ?? null,
            ];

            // Backwards-compatible single-guardian payload (old client).
            if (! empty($data['guardian']) && is_array($data['guardian'])) {
                $legacy = $data['guardian'];
                $guardianBatches['father'] = $guardianBatches['father'] ?? [
                    'name' => $legacy['guardian_name']
                        ?? $legacy['father_name']
                        ?? $legacy['mother_name']
                        ?? null,
                    'phone' => $legacy['phone'] ?? null,
                    'email' => $legacy['email'] ?? null,
                    'system_email' => $legacy['system_email'] ?? null,
                    'relationship' => $legacy['relationship'] ?? 'guardian',
                    'linked_guardian_id' => $legacy['linked_guardian_id'] ?? null,
                ];
            }

            foreach ($guardianBatches as $type => $guardian) {
                if (! is_array($guardian) || $this->isEmptyGuardian($guardian)) {
                    continue;
                }

                $profile = $this->attachGuardian($guardian, $type, $school);

                $student->guardians()->syncWithoutDetaching([
                    $profile->id => [
                        'relationship' => $guardian['relationship'] ?? $type,
                        'is_primary' => $type === 'father',
                    ],
                ]);
            }

            AuditLogger::log('student.created', $student, null, $student->toArray());

            return $student;
        });
    }

    public function archive(Student $student, ?string $reason = null): Student
    {
        $student->update(['status' => 'archived']);
        AuditLogger::log('student.archived', $student, null, ['status' => 'archived'], $reason);

        return $student;
    }

    protected function createStudentUser(array $data, School $school): ?User
    {
        if (empty($data['system_email'])) {
            return null;
        }

        $user = User::create([
            'school_id' => $school->id,
            'name' => trim(($data['first_name'] ?? '').' '.($data['last_name'] ?? '')),
            'system_email' => $data['system_email'],
            'email' => $data['email'] ?? null,
            'password' => Str::random(32),
            'locale' => 'en',
            'status' => UserStatus::Invited,
        ]);

        $this->assignRole($user, 'student', $school);

        $this->activation->invite($user, $data['email'] ?? null);

        return $user;
    }

    /**
     * Finds or creates a guardian profile + its user account.
     * If a linked_guardian_id is supplied (via the "link" button in the UI),
     * the existing profile is reused so one guardian account covers many children.
     */
    protected function attachGuardian(array $data, string $type, School $school): Guardian
    {
        if (! empty($data['linked_guardian_id'])) {
            return $school->guardians()->findOrFail((int) $data['linked_guardian_id']);
        }

        $guardian = $school->guardians()->create([
            'name' => $data['name'] ?? null,
            'relationship' => $data['relationship'] ?? $type,
            'phone' => $data['phone'] ?? null,
            'email' => $data['email'] ?? null,
            'system_email' => $data['system_email'] ?? null,
            'address' => $data['address'] ?? null,
            'occupation' => $data['occupation'] ?? null,
        ]);

        $guardianUser = $this->createGuardianUser($data, $guardian, $school);

        if ($guardianUser) {
            $guardian->update(['user_id' => $guardianUser->id]);
        }

        return $guardian;
    }

    protected function createGuardianUser(array $data, Guardian $guardian, School $school): ?User
    {
        if (empty($data['system_email'])) {
            return null;
        }

        $user = User::create([
            'school_id' => $school->id,
            'name' => $data['name'] ?? $guardian->displayName(),
            'system_email' => $data['system_email'],
            'email' => $data['email'] ?? null,
            'password' => Str::random(32),
            'locale' => 'en',
            'status' => UserStatus::Invited,
        ]);

        $this->assignRole($user, 'parent', $school);

        $this->activation->invite($user, $data['email'] ?? null);

        return $user;
    }

    protected function assignRole(User $user, string $role, School $school): void
    {
        $registrar = app(PermissionRegistrar::class);
        $registrar->setPermissionsTeamId($school->id);
        $user->assignRole($role);
    }

    protected function isEmptyGuardian(array $guardian): bool
    {
        return empty($guardian['name'])
            && empty($guardian['email'])
            && empty($guardian['system_email'])
            && empty($guardian['linked_guardian_id']);
    }
}
