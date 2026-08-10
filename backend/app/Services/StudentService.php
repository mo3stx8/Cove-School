<?php

namespace App\Services;

use App\Models\School;
use App\Models\Student;
use App\Models\User;
use App\Support\AuditLogger;
use App\Support\NumberGenerator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\PermissionRegistrar;

class StudentService
{
    public function enroll(array $data, School $school, User $actor): Student
    {
        return DB::transaction(function () use ($data, $school, $actor) {
            $user = null;

            if (! empty($data['email'])) {
                $user = User::firstOrCreate(
                    ['email' => $data['email']],
                    [
                        'school_id' => $school->id,
                        'name' => trim(($data['first_name'] ?? '').' '.($data['last_name'] ?? '')),
                        'password' => Hash::make($data['password'] ?? str()->random(12)),
                        'locale' => 'en',
                        'status' => 'active',
                    ],
                );

                $registrar = app(PermissionRegistrar::class);
                $registrar->setPermissionsTeamId($school->id);
                $user->assignRole('student');
            }

            $student = $school->students()->create([
                'user_id' => $user?->id,
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

            if (! empty($data['guardian'])) {
                $guardian = $school->guardians()->updateOrCreate(
                    ['email' => $data['guardian']['email'] ?? null],
                    array_merge($data['guardian'], ['school_id' => $school->id]),
                );

                $guardianUser = $guardian->user_id
                    ? $guardian->user
                    : $guardian->user()->create([
                        'school_id' => $school->id,
                        'name' => $guardian->displayName(),
                        'email' => $data['guardian']['email'] ?? null,
                        'password' => Hash::make($data['guardian']['password'] ?? str()->random(12)),
                        'status' => 'active',
                    ]);

                if ($guardianUser) {
                    $guardian->update(['user_id' => $guardianUser->id]);

                    $registrar = app(PermissionRegistrar::class);
                    $registrar->setPermissionsTeamId($school->id);
                    $guardianUser->assignRole('parent');
                }

                $student->guardians()->syncWithoutDetaching([
                    $guardian->id => [
                        'relationship' => $data['guardian']['relationship'] ?? 'guardian',
                        'is_primary' => true,
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
}
