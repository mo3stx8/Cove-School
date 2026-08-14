<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\GradeStatus;
use App\Http\Controllers\Controller;
use App\Models\Exam;
use App\Models\ExamCorrection;
use App\Models\ExamResult;
use App\Models\ExamSubject;
use App\Services\GradeWorkflowService;
use App\Support\AuditLogger;
use App\Support\TenantContext;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class ExamController extends Controller
{
    public function __construct(private readonly GradeWorkflowService $grades) {}

    public function index(Request $request)
    {
        Gate::authorize('viewAny', Exam::class);

        $user = $request->user();

        $query = Exam::query()
            ->with(['academicYear', 'term', 'examSubjects.subject', 'examSubjects.class'])
            ->when($request->input('academic_year_id'), fn ($q, $id) => $q->where('academic_year_id', $id))
            ->when($request->input('term_id'), fn ($q, $id) => $q->where('term_id', $id))
            ->when($request->input('search'), fn ($q, $s) => $q->where('name', 'ilike', "%{$s}%"))
            ->latest();

        if ($user->hasRole('student') || $user->hasRole('parent')) {
            $classIds = $user->hasRole('parent')
                ? $user->guardians()->with('students:id,class_id')->get()
                    ->flatMap(fn ($g) => $g->students->pluck('class_id'))
                    ->filter()
                    ->unique()
                : collect([$user->student?->class_id])->filter();

            abort_if($classIds->isEmpty(), 403, 'No class linked to your account.');
            $query->whereHas('examSubjects', fn ($q) => $q->whereIn('class_id', $classIds));
        }

        return response()->json(['data' => $query->paginate($request->integer('per_page', 25))]);
    }

    public function store(Request $request)
    {
        Gate::authorize('create', Exam::class);

        $school = app(TenantContext::class)->school();

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'type' => ['sometimes', 'string', 'in:exam,quiz,midterm,final'],
            'academic_year_id' => ['required', Rule::exists('academic_years', 'id')->where('school_id', $school->id)],
            'term_id' => ['nullable', Rule::exists('terms', 'id')->where('school_id', $school->id)],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date', 'after_or_equal:start_date'],
            'subjects' => ['sometimes', 'array'],
            'subjects.*.class_id' => ['required', Rule::exists('classes', 'id')->where('school_id', $school->id)],
            'subjects.*.subject_id' => ['required', Rule::exists('subjects', 'id')->where('school_id', $school->id)],
            'subjects.*.teacher_id' => ['nullable', Rule::exists('users', 'id')->where('school_id', $school->id)],
            'subjects.*.full_marks' => ['sometimes', 'numeric', 'min:1', 'max:1000'],
            'subjects.*.pass_marks' => ['sometimes', 'numeric', 'min:0', 'max:1000'],
        ]);

        $exam = $school->exams()->create([
            'name' => $data['name'],
            'type' => $data['type'] ?? 'exam',
            'academic_year_id' => $data['academic_year_id'],
            'term_id' => $data['term_id'] ?? null,
            'start_date' => $data['start_date'] ?? null,
            'end_date' => $data['end_date'] ?? null,
            'status' => 'draft',
        ]);

        foreach ($data['subjects'] ?? [] as $item) {
            $exam->examSubjects()->create([
                'school_id' => app(TenantContext::class)->schoolId(),
                'class_id' => $item['class_id'],
                'subject_id' => $item['subject_id'],
                'teacher_id' => $item['teacher_id'] ?? null,
                'full_marks' => $item['full_marks'] ?? 100,
                'pass_marks' => $item['pass_marks'] ?? 50,
            ]);
        }

        AuditLogger::log('exam.created', $exam, null, $data);

        return response()->json(['data' => $exam->load('examSubjects.subject', 'examSubjects.class')], 201);
    }

    public function show(Request $request, Exam $exam)
    {
        Gate::authorize('view', $exam);

        $exam->load(['academicYear', 'term', 'examSubjects.subject', 'examSubjects.class', 'examSubjects.teacher']);

        return response()->json(['data' => $exam]);
    }

    public function update(Request $request, Exam $exam)
    {
        Gate::authorize('update', $exam);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'type' => ['sometimes', 'string', 'in:exam,quiz,midterm,final'],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date', 'after_or_equal:start_date'],
            'status' => ['sometimes', 'in:draft,published'],
        ]);

        $exam->update($data);
        AuditLogger::log('exam.updated', $exam);

        return response()->json(['data' => $exam]);
    }

    public function examSubject(Request $request, ExamSubject $examSubject)
    {
        Gate::authorize('view', $examSubject);

        $examSubject->load(['exam', 'class.grade', 'subject', 'results.student']);

        return response()->json(['data' => $examSubject]);
    }

    public function saveMarks(Request $request, ExamSubject $examSubject)
    {
        Gate::authorize('enterGrades', $examSubject);

        $data = $request->validate([
            'marks' => ['required', 'array'],
            'marks.*' => ['nullable', 'numeric', 'min:0'],
        ]);

        $this->grades->saveMarks($examSubject, $data['marks'], $request->user());

        return response()->json(['message' => 'Marks saved.']);
    }

    public function submitGrades(Request $request, ExamSubject $examSubject)
    {
        Gate::authorize('enterGrades', $examSubject);

        $this->grades->transition($examSubject, GradeStatus::Submitted, $request->user());

        return response()->json(['message' => 'Grades submitted for review.']);
    }

    public function reviewGrades(Request $request, ExamSubject $examSubject)
    {
        Gate::authorize('review', $examSubject);

        $this->grades->transition($examSubject, GradeStatus::Reviewed, $request->user());

        return response()->json(['message' => 'Grades reviewed.']);
    }

    public function publishGrades(Request $request, ExamSubject $examSubject)
    {
        Gate::authorize('publish', $examSubject);

        $this->grades->transition($examSubject, GradeStatus::Published, $request->user());

        \App\Services\NotificationService::gradesPublished($examSubject);

        return response()->json(['message' => 'Grades published.']);
    }

    public function requestCorrection(Request $request, ExamResult $examResult)
    {
        Gate::authorize('correct', $examResult->examSubject);

        $data = $request->validate([
            'new_marks' => ['required', 'numeric', 'min:0'],
            'reason' => ['required', 'string', 'max:1000'],
        ]);

        $examResult->corrections()->create([
            'school_id' => app(TenantContext::class)->schoolId(),
            'requested_by' => $request->user()->id,
            'old_marks' => $examResult->marks,
            'new_marks' => $data['new_marks'],
            'reason' => $data['reason'],
            'status' => 'pending',
        ]);

        AuditLogger::log('exam.correction_requested', $examResult, ['marks' => $examResult->marks], ['marks' => $data['new_marks']], $data['reason']);

        return response()->json(['message' => 'Correction request submitted.']);
    }

    public function corrections(Request $request)
    {
        abort_unless($request->user()->hasPermissionTo('grades.publish'), 403);

        $corrections = ExamCorrection::query()
            ->where('status', 'pending')
            ->with(['examResult.student', 'examResult.examSubject.subject', 'requester'])
            ->latest()
            ->paginate($request->integer('per_page', 25));

        return response()->json(['data' => $corrections]);
    }

    public function reviewCorrection(Request $request, ExamCorrection $correction)
    {
        abort_unless($request->user()->hasPermissionTo('grades.publish'), 403);

        $data = $request->validate(['approve' => ['required', 'boolean']]);

        $correction->update([
            'status' => $data['approve'] ? 'approved' : 'rejected',
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
        ]);

        if ($data['approve']) {
            $result = $correction->examResult;

            $result->update([
                'marks' => $correction->new_marks,
                'grade' => \App\Services\GradeService::gradeFor(
                    app(TenantContext::class)->schoolId(),
                    \App\Services\GradeService::percentage($correction->new_marks, $result->examSubject->full_marks),
                )?->name,
            ]);
        }

        AuditLogger::log('exam.correction_'.($data['approve'] ? 'approved' : 'rejected'), $correction->examResult);

        return response()->json(['message' => $data['approve'] ? 'Correction approved.' : 'Correction rejected.']);
    }
}
