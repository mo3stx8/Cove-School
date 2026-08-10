<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AcademicYear;
use App\Models\Grade;
use App\Models\Subject;
use App\Models\Term;
use App\Support\AuditLogger;
use App\Support\TenantContext;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class AcademicController extends Controller
{
    // ---- Academic Years & Terms ----

    public function academicYears(Request $request)
    {
        $years = AcademicYear::query()->with('terms')->orderBy('start_date', 'desc')->get();

        return response()->json(['data' => $years]);
    }

    public function setCurrentAcademicYear(Request $request, AcademicYear $year)
    {
        $school = app(TenantContext::class)->school();

        AcademicYear::where('school_id', $school->id)->update(['is_current' => false]);
        $year->update(['is_current' => true]);
        $school->update(['current_academic_year_id' => $year->id]);

        AuditLogger::log('academic_year.set_current', $year);

        return response()->json(['data' => $year->load('terms')]);
    }

    public function storeTerm(Request $request, AcademicYear $year)
    {
        $school = app(TenantContext::class)->school();

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'term_number' => ['required', 'integer', 'min:1'],
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
            'is_current' => ['sometimes', 'boolean'],
        ]);

        $term = $year->terms()->create([
            'school_id' => $school->id,
            'name' => $data['name'],
            'term_number' => $data['term_number'],
            'start_date' => $data['start_date'],
            'end_date' => $data['end_date'],
            'is_current' => $data['is_current'] ?? false,
        ]);

        AuditLogger::log('term.created', $term);

        return response()->json(['data' => $term], 201);
    }

    public function updateTerm(Request $request, Term $term)
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'start_date' => ['sometimes', 'date'],
            'end_date' => ['sometimes', 'date', 'after_or_equal:start_date'],
            'is_current' => ['sometimes', 'boolean'],
        ]);

        $term->update($data);
        AuditLogger::log('term.updated', $term);

        return response()->json(['data' => $term]);
    }

    // ---- Grades ----

    public function grades()
    {
        Gate::authorize('viewAny', Grade::class);

        $grades = Grade::query()->withCount('classes')->orderBy('level')->get();

        return response()->json(['data' => $grades]);
    }

    public function storeGrade(Request $request)
    {
        Gate::authorize('create', Grade::class);

        $school = app(TenantContext::class)->school();

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'level' => ['required', 'integer', 'min:1', 'max:15'],
            'description' => ['nullable', 'string'],
        ]);

        $grade = $school->grades()->create($data);
        AuditLogger::log('grade.created', $grade);

        return response()->json(['data' => $grade], 201);
    }

    public function updateGrade(Request $request, Grade $grade)
    {
        Gate::authorize('update', Grade::class);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $grade->update($data);
        AuditLogger::log('grade.updated', $grade);

        return response()->json(['data' => $grade]);
    }

    // ---- Subjects ----

    public function subjects()
    {
        Gate::authorize('viewAny', Subject::class);

        $subjects = Subject::query()->orderBy('name')->get();

        return response()->json(['data' => $subjects]);
    }

    public function storeSubject(Request $request)
    {
        Gate::authorize('create', Subject::class);

        $school = app(TenantContext::class)->school();

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'code' => ['nullable', 'string', 'max:16'],
            'description' => ['nullable', 'string'],
        ]);

        $subject = $school->subjects()->create($data);
        AuditLogger::log('subject.created', $subject);

        return response()->json(['data' => $subject], 201);
    }

    public function updateSubject(Request $request, Subject $subject)
    {
        Gate::authorize('update', Subject::class);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'code' => ['nullable', 'string', 'max:16'],
            'description' => ['nullable', 'string'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $subject->update($data);
        AuditLogger::log('subject.updated', $subject);

        return response()->json(['data' => $subject]);
    }

    // ---- Grade Scales ----

    public function gradeScales()
    {
        Gate::authorize('view', \App\Models\GradeScale::class);

        return response()->json(['data' => \App\Models\GradeScale::query()->orderBy('min_percentage')->get()]);
    }

    public function storeGradeScale(Request $request)
    {
        Gate::authorize('update', \App\Models\GradeScale::class);

        $school = app(TenantContext::class)->school();

        $data = $request->validate([
            'name' => ['required', 'string', 'max:64'],
            'min_percentage' => ['required', 'integer', 'min:0', 'max:100'],
            'max_percentage' => ['required', 'integer', 'min:0', 'max:100', 'gte:min_percentage'],
            'points' => ['nullable', 'numeric'],
            'color' => ['nullable', 'string', 'max:16'],
        ]);

        $scale = $school->gradeScales()->create($data);
        AuditLogger::log('grade_scale.created', $scale);

        return response()->json(['data' => $scale], 201);
    }
}
