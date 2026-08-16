<?php

namespace App\Services;

use App\Models\Guardian;
use App\Models\User;

/**
 * Resolves who owns a given real email address so the student / parent /
 * teacher forms can warn about duplicates ("this email already belongs to X").
 *
 * A single address may legitimately appear on a guardian profile and on the
 * guardian's own user account (same person). It must never be shared by two
 * different people.
 */
class EmailUniquenessService
{
    public const TYPE_STUDENT = 'student';
    public const TYPE_TEACHER = 'teacher';
    public const TYPE_GUARDIAN = 'guardian';
    public const TYPE_ADMIN = 'admin';

    /**
     * Returns a description of the person who currently owns $email,
     * or null when the address is free.
     */
    public function ownerOf(string $email): ?array
    {
        $email = strtolower(trim($email));
        if ($email === '') {
            return null;
        }

        $user = User::query()
            ->whereRaw('lower(email) = ?', [$email])
            ->with(['student', 'teacher', 'guardians'])
            ->first();

        if ($user) {
            return $this->userOwner($user);
        }

        $guardian = Guardian::query()
            ->whereRaw('lower(email) = ?', [$email])
            ->with('user:id,name,system_email,email')
            ->withCount('students')
            ->first();

        if ($guardian) {
            return $this->guardianOwner($guardian);
        }

        return null;
    }

    /**
     * Throws a validation error for the first conflicting address among
     * $labels, using $owner for the message. Emails are normalized first so
     * father == mother within the same payload is caught too.
     */
    public function assertUnique(array $emails, array $exceptUserIds = []): void
    {
        $seen = [];

        foreach ($emails as $field => $email) {
            $email = strtolower(trim((string) $email));
            if ($email === '') {
                continue;
            }

            if (isset($seen[$email])) {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    $field => "This email is already used by another person in this form.",
                ]);
            }
            $seen[$email] = true;

            $owner = $this->ownerOf($email);
            if ($owner) {
                if (in_array($owner['user_id'], $exceptUserIds, true)) {
                    continue;
                }
                throw \Illuminate\Validation\ValidationException::withMessages([
                    $field => $this->message($owner),
                ]);
            }
        }
    }

    public function message(array $owner): string
    {
        return "This email is already used by {$owner['name']} ({$owner['context']}).";
    }

    protected function userOwner(User $user): array
    {
        if ($user->teacher) {
            return [
                'type' => self::TYPE_TEACHER,
                'relationship' => null,
                'name' => $user->name,
                'system_email' => $user->system_email,
                'context' => 'Teacher',
                'guardian_id' => null,
                'user_id' => $user->id,
                'linked_students_count' => null,
            ];
        }

        if ($user->student) {
            $student = $user->student;

            return [
                'type' => self::TYPE_STUDENT,
                'relationship' => null,
                'name' => $user->name,
                'system_email' => $user->system_email,
                'context' => 'Student '.($student->student_number ?? ''),
                'guardian_id' => null,
                'user_id' => $user->id,
                'linked_students_count' => null,
            ];
        }

        $guardian = $user->guardians->first();

        if ($guardian) {
            return $this->guardianOwner($guardian);
        }

        $role = $user->roles->pluck('name')->first() ?? 'admin';

        return [
            'type' => self::TYPE_ADMIN,
            'relationship' => null,
            'name' => $user->name,
            'system_email' => $user->system_email,
            'context' => ucfirst($role),
            'guardian_id' => null,
            'user_id' => $user->id,
            'linked_students_count' => null,
        ];
    }

    protected function guardianOwner(Guardian $guardian): array
    {
        $relationship = ucfirst((string) ($guardian->relationship ?: 'parent'));
        $count = $guardian->students_count ?? $guardian->students()->count();
        $context = $count > 0
            ? $relationship.' of '.$count.' student'.($count === 1 ? '' : 's')
            : $relationship;

        return [
            'type' => self::TYPE_GUARDIAN,
            'relationship' => $guardian->relationship,
            'name' => $guardian->displayName(),
            'system_email' => $guardian->system_email ?? $guardian->user?->system_email,
            'email' => $guardian->email,
            'context' => $context,
            'guardian_id' => $guardian->id,
            'user_id' => $guardian->user_id,
            'linked_students_count' => $count,
        ];
    }
}
