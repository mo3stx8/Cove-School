<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RolesAndPermissionsSeeder extends Seeder
{
    /**
     * Canonical permission list. These are global (not tied to a school),
     * while roles are created per school.
     */
    public static function permissionList(): array
    {
        return [
            'school.view', 'school.update',
            'users.view', 'users.create', 'users.update', 'users.delete',
            'roles.view', 'roles.update',
            'students.view', 'students.create', 'students.update', 'students.archive',
            'students.manage_documents',
            'teachers.view', 'teachers.create', 'teachers.update', 'teachers.archive',
            'guardians.view', 'guardians.create', 'guardians.update',
            'classes.view', 'classes.create', 'classes.update', 'classes.delete',
            'grades.view', 'grades.create', 'grades.update',
            'subjects.view', 'subjects.create', 'subjects.update',
            'timetables.view', 'timetables.manage',
            'attendance.view', 'attendance.take', 'attendance.correct', 'attendance.approve_corrections',
            'exams.view', 'exams.create', 'exams.update', 'exams.publish',
            'grades.enter', 'grades.review', 'grades.publish', 'grades.correct',
            'assignments.view', 'assignments.create', 'assignments.grade',
            'fees.view', 'fees.create', 'fees.update',
            'payments.view', 'payments.create',
            'reports.view',
            'announcements.view', 'announcements.create',
            'settings.manage',
        ];
    }

    public static function roleDefinitions(): array
    {
        return [
            'super_admin' => null, // wildcard via Gate::before
            'admin' => ['school.view', 'school.update', 'users.view', 'users.create', 'users.update', 'users.delete',
                'roles.view', 'students.view', 'students.create', 'students.update', 'students.archive',
                'students.manage_documents', 'teachers.view', 'teachers.create', 'teachers.update', 'teachers.archive',
                'guardians.view', 'guardians.create', 'guardians.update', 'classes.view', 'classes.create',
                'classes.update', 'classes.delete', 'grades.view', 'grades.create', 'grades.update',
                'subjects.view', 'subjects.create', 'subjects.update', 'timetables.view', 'timetables.manage',
                'attendance.view', 'attendance.take', 'attendance.correct', 'attendance.approve_corrections',
                'exams.view', 'exams.create', 'exams.update', 'exams.publish', 'grades.enter', 'grades.review',
                'grades.publish', 'grades.correct', 'assignments.view', 'assignments.create', 'assignments.grade',
                'fees.view', 'fees.create', 'fees.update', 'payments.view', 'payments.create', 'reports.view',
                'announcements.view', 'announcements.create', 'settings.manage'],
            'teacher' => ['classes.view', 'students.view', 'timetables.view', 'attendance.view', 'attendance.take',
                'attendance.correct', 'exams.view', 'grades.enter', 'assignments.view', 'assignments.create',
                'assignments.grade', 'announcements.view'],
            'accountant' => ['students.view', 'fees.view', 'fees.create', 'payments.view', 'payments.create',
                'reports.view', 'announcements.view'],
            'student' => ['students.view', 'timetables.view', 'attendance.view', 'exams.view',
                'assignments.view', 'announcements.view'],
            'parent' => ['students.view', 'timetables.view', 'attendance.view', 'exams.view',
                'assignments.view', 'fees.view', 'announcements.view'],
        ];
    }

    public function run(?int $schoolId = null): void
    {
        $registrar = app(PermissionRegistrar::class);
        $registrar->forgetCachedPermissions();

        $now = now();

        foreach (static::permissionList() as $permission) {
            Permission::query()->updateOrCreate(
                ['name' => $permission, 'guard_name' => 'web'],
                ['updated_at' => $now],
            );
        }

        if ($schoolId) {
            $registrar->setPermissionsTeamId($schoolId);

            foreach (static::roleDefinitions() as $name => $permissions) {
                $role = Role::query()->updateOrCreate(
                    ['name' => $name, 'guard_name' => 'web', 'school_id' => $schoolId],
                    ['updated_at' => $now],
                );

                if ($permissions === null) {
                    $role->syncPermissions(static::permissionList());
                } else {
                    $role->syncPermissions($permissions);
                }
            }
        }

        $registrar->forgetCachedPermissions();
    }
}
