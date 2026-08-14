<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\School;
use App\Models\User;
use App\Support\AuditLogger;
use App\Support\TenantContext;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Spatie\Permission\PermissionRegistrar;

class SetupController extends Controller
{
    public function register(Request $request)
    {
        $data = $request->validate([
            'school_name' => ['required', 'string', 'max:255'],
            'slug' => ['required', 'string', 'max:255', 'regex:/^[a-z0-9\-]+$/', Rule::unique('schools', 'slug')],
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')],
            'password' => ['required', 'string', 'min:10', 'max:64', 'confirmed'],
            'country' => ['sometimes', 'nullable', 'string', 'max:100'],
            'currency' => ['sometimes', 'nullable', 'string', 'size:3'],
            'timezone' => ['sometimes', 'nullable', 'string', 'max:64'],
        ]);

        $school = DB::transaction(function () use ($data) {
            $school = School::create([
                'name' => $data['school_name'],
                'slug' => $data['slug'],
                'country' => $data['country'] ?? null,
                'currency' => $data['currency'] ?? 'USD',
                'timezone' => $data['timezone'] ?? 'UTC',
                'status' => 'trial',
                'subscription_plan' => 'starter',
            ]);

            $user = User::create([
                'school_id' => $school->id,
                'name' => $data['name'],
                'email' => $data['email'],
                'password' => Hash::make($data['password']),
                'locale' => 'en',
                'timezone' => $school->timezone,
                'status' => 'active',
                'email_verified_at' => now(),
            ]);

            (new RolesAndPermissionsSeeder)->run($school->id);

            $registrar = app(PermissionRegistrar::class);
            $registrar->setPermissionsTeamId($school->id);
            $user->assignRole('super_admin');

            return $school;
        });

        AuditLogger::log('setup.school_registered', $school);

        return response()->json([
            'message' => 'School registered successfully.',
            'school' => $school,
        ], 201);
    }

    public function progress(Request $request)
    {
        $school = app(TenantContext::class)->school();
        $school->loadCount([
            'academicYears', 'grades', 'subjects', 'students', 'teachers',
        ]);
        $school->setAttribute('terms_count', $school->terms()->count());
        $school->setAttribute('grade_scales_count', $school->gradeScales()->count());
        $school->setAttribute('fee_types_count', $school->feeTypes()->count());

        $steps = [
            'school_information' => $school->name !== null && $school->address !== null,
            'academic_year' => $school->academicYears()->count() > 0,
            'structure' => $school->grades()->count() > 0,
            'users' => $school->users()->count() >= 1,
            'grading' => $school->gradeScales()->count() > 0,
            'fees' => $school->feeTypes()->count() > 0,
        ];

        return response()->json([
            'steps' => $steps,
            'all_complete' => ! in_array(false, $steps, true),
            'school' => $school,
        ]);
    }

    public function updateSchool(Request $request)
    {
        abort_unless($request->user()->hasPermissionTo('school.update'), 403);

        $school = app(TenantContext::class)->school();

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'logo' => ['sometimes', 'nullable', 'string'],
            'address' => ['sometimes', 'nullable', 'string'],
            'city' => ['sometimes', 'nullable', 'string'],
            'country' => ['sometimes', 'nullable', 'string'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:32'],
            'email' => ['sometimes', 'nullable', 'email'],
            'website' => ['sometimes', 'nullable', 'url'],
            'currency' => ['sometimes', 'string', 'size:3'],
            'timezone' => ['sometimes', 'string', 'max:64'],
        ]);

        $school->update($data);
        AuditLogger::log('school.updated', $school, null, $data);

        return response()->json(['school' => $school]);
    }

    public function createAcademicYear(Request $request)
    {
        abort_unless($request->user()->hasPermissionTo('settings.manage'), 403);

        $school = app(TenantContext::class)->school();

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
            'make_current' => ['sometimes', 'boolean'],
            'terms' => ['sometimes', 'array', 'min:1'],
            'terms.*.name' => ['required', 'string'],
            'terms.*.term_number' => ['required', 'integer', 'min:1'],
            'terms.*.start_date' => ['required', 'date'],
            'terms.*.end_date' => ['required', 'date', 'after_or_equal:terms.*.start_date'],
        ]);

        $year = DB::transaction(function () use ($data, $school) {
            $isCurrent = $data['make_current'] ?? ($school->academicYears()->count() === 0);

            if ($isCurrent) {
                $school->academicYears()->update(['is_current' => false]);
            }

            $year = $school->academicYears()->create([
                'name' => $data['name'],
                'start_date' => $data['start_date'],
                'end_date' => $data['end_date'],
                'is_current' => $isCurrent,
            ]);

            foreach ($data['terms'] ?? [] as $term) {
                $year->terms()->create([
                    'school_id' => $school->id,
                    'name' => $term['name'],
                    'term_number' => $term['term_number'],
                    'start_date' => $term['start_date'],
                    'end_date' => $term['end_date'],
                    'is_current' => $term['term_number'] === 1,
                ]);
            }

            if ($isCurrent) {
                $school->update(['current_academic_year_id' => $year->id]);
            }

            return $year;
        });

        AuditLogger::log('academic_year.created', $year);

        return response()->json(['academic_year' => $year->load('terms')], 201);
    }
}
