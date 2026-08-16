<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\SchoolClass;
use App\Support\AuditLogger;
use App\Support\TenantContext;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class SchoolClassController extends Controller
{
    public function index(Request $request)
    {
        Gate::authorize('viewAny', SchoolClass::class);

        $classes = SchoolClass::query()
            ->with(['grade', 'academicYear', 'classTeacher', 'classSubjects.subject'])
            ->when($request->input('grade_id'), fn ($q, $id) => $q->where('grade_id', $id))
            ->when($request->input('academic_year_id'), fn ($q, $id) => $q->where('academic_year_id', $id))
            ->when($request->input('search'), fn ($q, $s) => $q->where('name', 'ilike', "%{$s}%"))
            ->withCount('students')
            ->orderBy('grade_id')
            ->get()
            ->map(fn ($class) => $this->format($class));

        return response()->json(['data' => $classes]);
    }

    public function store(Request $request)
    {
        Gate::authorize('create', SchoolClass::class);

        $school = app(TenantContext::class)->school();

        $data = $request->validate([
            'academic_year_id' => ['required', 'exists:academic_years,id'],
            'grade_id' => ['required', 'exists:grades,id'],
            'section_name' => ['required', 'string', 'max:16'],
            'name_ar' => ['nullable', 'string', 'max:255'],
            'room' => ['nullable', 'string', 'max:64'],
            'class_teacher_id' => ['nullable', 'exists:users,id'],
            'capacity' => ['nullable', 'integer', 'min:1', 'max:500'],
        ]);

        $grade = \App\Models\Grade::findOrFail($data['grade_id']);

        $class = $school->classes()->create([
            'academic_year_id' => $data['academic_year_id'],
            'grade_id' => $data['grade_id'],
            'section_name' => $data['section_name'],
            'name' => "{$grade->name} {$data['section_name']}",
            'name_ar' => $data['name_ar'] ?? (($grade->name_ar ? "{$grade->name_ar} {$data['section_name']}" : null)),
            'room' => $data['room'] ?? null,
            'class_teacher_id' => $data['class_teacher_id'] ?? null,
            'capacity' => $data['capacity'] ?? null,
        ]);

        AuditLogger::log('class.created', $class);

        return response()->json(['data' => $this->format($class->load('grade', 'academicYear', 'classTeacher'))], 201);
    }

    public function show(Request $request, SchoolClass $class)
    {
        Gate::authorize('view', $class);

        $class->load(['grade', 'academicYear', 'classTeacher', 'students.user', 'classSubjects.subject']);

        return response()->json(['data' => $this->format($class, true)]);
    }

    public function update(Request $request, SchoolClass $class)
    {
        Gate::authorize('update', $class);

        $data = $request->validate([
            'section_name' => ['sometimes', 'string', 'max:16'],
            'name_ar' => ['nullable', 'string', 'max:255'],
            'room' => ['nullable', 'string', 'max:64'],
            'class_teacher_id' => ['nullable', 'exists:users,id'],
            'capacity' => ['nullable', 'integer', 'min:1', 'max:500'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        if (isset($data['section_name'])) {
            $data['name'] = "{$class->grade->name} {$data['section_name']}";
            if (($data['name_ar'] ?? null) === null && $class->grade->name_ar) {
                $data['name_ar'] = "{$class->grade->name_ar} {$data['section_name']}";
            }
        }

        $class->update($data);
        AuditLogger::log('class.updated', $class);

        return response()->json(['data' => $this->format($class->load('grade'))]);
    }

    public function destroy(Request $request, SchoolClass $class)
    {
        Gate::authorize('delete', $class);

        if ($class->students()->exists()) {
            return response()->json(['message' => 'Cannot delete a class that has students. Archive the students first.'], 409);
        }

        $class->update(['is_active' => false]);
        AuditLogger::log('class.archived', $class);

        return response()->json(['message' => 'Class archived.']);
    }

    public function assignSubjects(Request $request, SchoolClass $class)
    {
        Gate::authorize('update', $class);

        $data = $request->validate([
            'subjects' => ['required', 'array'],
            'subjects.*.subject_id' => ['required', 'exists:subjects,id'],
            'subjects.*.teacher_id' => ['nullable', 'exists:users,id'],
            'subjects.*.weekly_periods' => ['nullable', 'integer', 'min:0', 'max:40'],
        ]);

        $school = app(TenantContext::class)->school();

        $subjectIds = collect($data['subjects'])->pluck('subject_id')->map('intval')->all();

        foreach ($data['subjects'] as $item) {
            $class->classSubjects()->updateOrCreate(
                ['school_id' => $school->id, 'subject_id' => $item['subject_id']],
                [
                    'teacher_id' => $item['teacher_id'] ?? null,
                    'weekly_periods' => $item['weekly_periods'] ?? 0,
                    'is_active' => true,
                ],
            );
        }

        if ($subjectIds !== []) {
            $class->classSubjects()
                ->where('school_id', $school->id)
                ->whereNotIn('subject_id', $subjectIds)
                ->delete();
        }

        AuditLogger::log('class.subjects_assigned', $class, null, $data['subjects']);

        return response()->json(['data' => $this->format($class->load('classSubjects.subject'), true)]);
    }

    public function assignStudents(Request $request, SchoolClass $class)
    {
        Gate::authorize('update', $class);

        $data = $request->validate([
            'student_ids' => ['required', 'array'],
            'student_ids.*' => ['exists:students,id'],
        ]);

        $ids = array_unique(array_map('intval', $data['student_ids']));

        $old = $class->students()->pluck('id')->all();
        $count = \App\Models\Student::whereIn('id', $ids)->update(['class_id' => $class->id]);

        AuditLogger::log('class.students_assigned', $class, ['student_ids' => $old], ['student_ids' => $ids]);

        return response()->json(['message' => "{$count} student(s) assigned.", 'students_count' => $class->students()->count()]);
    }

    protected function format(SchoolClass $class, bool $detail = false): array
    {
        return [
            'id' => $class->id,
            'name' => $class->name,
            'name_ar' => $class->name_ar,
            'section_name' => $class->section_name,
            'room' => $class->room,
            'capacity' => $class->capacity,
            'is_active' => $class->is_active,
            'students_count' => $class->students_count ?? $class->students()->count(),
            'grade' => $class->grade ? ['id' => $class->grade->id, 'name' => $class->grade->name, 'name_ar' => $class->grade->name_ar] : null,
            'academic_year' => $class->academicYear ? ['id' => $class->academicYear->id, 'name' => $class->academicYear->name] : null,
            'class_teacher' => $class->classTeacher ? ['id' => $class->classTeacher->id, 'name' => $class->classTeacher->name] : null,
            'subjects' => $class->relationLoaded('classSubjects') ? $class->classSubjects->map(fn ($cs) => [
                'subject_id' => $cs->subject_id,
                'subject_name' => $cs->subject->name ?? null,
                'subject_name_ar' => $cs->subject->name_ar ?? null,
                'teacher_id' => $cs->teacher_id,
                'weekly_periods' => $cs->weekly_periods,
            ]) : null,
            'students' => $detail ? $class->students->map(fn ($s) => [
                'id' => $s->id,
                'name' => $s->fullName(),
                'student_number' => $s->student_number,
                'status' => $s->status->value,
            ]) : null,
        ];
    }
}
