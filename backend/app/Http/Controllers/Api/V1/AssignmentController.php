<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Assignment;
use App\Support\AuditLogger;
use App\Support\TenantContext;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class AssignmentController extends Controller
{
    private const ALLOWED_MIME = 'pdf,doc,docx,xls,xlsx,ppt,pptx,jpg,jpeg,png,txt,zip';

    public function index(Request $request)
    {
        Gate::authorize('viewAny', Assignment::class);

        $this->closeExpired();

        $user = $request->user();

        $query = Assignment::query()->with(['subject', 'class.grade', 'teacher'])
            ->when($request->input('class_id'), fn ($q, $id) => $q->where('class_id', $id))
            ->when($request->input('subject_id'), fn ($q, $id) => $q->where('subject_id', $id))
            ->when($request->input('status'), fn ($q, $s) => $q->where('status', $s));

        if ($user->hasRole('teacher')) {
            $query->where('teacher_id', $user->id);
        }

        if ($user->hasRole('student')) {
            $classId = $user->student?->class_id;
            abort_unless($classId, 403, 'No student profile linked to your account.');
            $query->where('class_id', $classId);
        }

        if ($user->hasRole('parent')) {
            $classIds = $user->guardians()->with('students:id,class_id')->get()
                ->flatMap(fn ($g) => $g->students->pluck('class_id'))
                ->filter()
                ->unique();
            abort_if($classIds->isEmpty(), 403, 'No children linked to your account.');
            $query->whereIn('class_id', $classIds);
        }

        return response()->json([
            'data' => $query->withCount('submissions')->latest()->paginate($request->integer('per_page', 25)),
        ]);
    }

    public function store(Request $request)
    {
        Gate::authorize('create', Assignment::class);

        $school = app(TenantContext::class)->school();

        $data = $request->validate([
            'class_id' => ['required', Rule::exists('classes', 'id')->where('school_id', $school->id)],
            'subject_id' => ['required', Rule::exists('subjects', 'id')->where('school_id', $school->id)],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'due_date' => ['required', 'date', 'after_or_equal:today'],
            'due_time' => ['nullable', 'date_format:H:i'],
            'attachments' => ['sometimes', 'array'],
            'attachments.*' => ['file', 'max:10240', 'mimes:'.self::ALLOWED_MIME],
        ]);

        $user = $request->user();
        if ($user->hasRole('teacher') && ! $user->hasRole('admin')) {
            $assigned = \App\Models\SchoolClass::where('id', $data['class_id'])->first()
                ?->classSubjects()->where('teacher_id', $user->id)->exists();
            abort_unless($assigned, 403, 'You can only create assignments for classes you teach.');
        }

        $assignment = $school->assignments()->create([
            'class_id' => $data['class_id'],
            'subject_id' => $data['subject_id'],
            'teacher_id' => $user->id,
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'due_date' => $data['due_date'],
            'due_time' => $data['due_time'] ?? null,
            'status' => 'published',
        ]);

        foreach ($request->file('attachments', []) as $file) {
            $path = $file->store('assignments', 'private');
            $assignment->attachments()->create([
                'school_id' => $school->id,
                'name' => $file->getClientOriginalName(),
                'path' => $path,
                'mime_type' => $file->getMimeType(),
                'size' => $file->getSize(),
            ]);
        }

        AuditLogger::log('assignment.created', $assignment);

        \App\Services\NotificationService::assignmentCreated($assignment);

        return response()->json(['data' => $assignment->load('subject', 'class', 'attachments')], 201);
    }

    public function show(Request $request, Assignment $assignment)
    {
        Gate::authorize('view', $assignment);

        if ($assignment->status === 'published' && $assignment->deadlinePassed()) {
            $assignment->update(['status' => 'closed']);
        }

        $assignment->load(['subject', 'class.grade', 'teacher', 'attachments', 'submissions.student']);

        return response()->json(['data' => $assignment]);
    }

    public function update(Request $request, Assignment $assignment)
    {
        Gate::authorize('update', $assignment);

        $school = app(TenantContext::class)->school();

        $data = $request->validate([
            'class_id' => ['sometimes', Rule::exists('classes', 'id')->where('school_id', $school->id)],
            'subject_id' => ['sometimes', Rule::exists('subjects', 'id')->where('school_id', $school->id)],
            'title' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'due_date' => ['sometimes', 'date'],
            'due_time' => ['nullable', 'date_format:H:i'],
        ]);

        $user = $request->user();
        if ($user->hasRole('teacher') && ! $user->hasRole('admin') && isset($data['class_id'])) {
            $assigned = \App\Models\SchoolClass::where('id', $data['class_id'])->first()
                ?->classSubjects()->where('teacher_id', $user->id)->exists();
            abort_unless($assigned, 403, 'You can only manage assignments for classes you teach.');
        }

        $assignment->update($data);
        AuditLogger::log('assignment.updated', $assignment);

        return response()->json(['data' => $assignment->load('subject', 'class', 'attachments')]);
    }

    public function destroy(Request $request, Assignment $assignment)
    {
        Gate::authorize('create', $assignment);

        $assignment->update(['status' => 'closed']);
        AuditLogger::log('assignment.closed', $assignment);

        return response()->json(['message' => 'Assignment closed.']);
    }

    public function submit(Request $request, Assignment $assignment)
    {
        Gate::authorize('view', $assignment);

        $student = $request->user()->student;

        if (! $student || $student->class_id !== $assignment->class_id) {
            abort(403, 'You are not enrolled in the class for this assignment.');
        }

        $data = $request->validate([
            'text' => ['required_without:file', 'nullable', 'string'],
            'file' => ['nullable', 'file', 'max:20480', 'mimes:'.self::ALLOWED_MIME],
            'excuse' => ['nullable', 'string', 'max:500'],
        ]);

        $late = $assignment->deadlinePassed();

        $submission = $assignment->submissions()->updateOrCreate(
            ['student_id' => $student->id],
            [
                'school_id' => app(TenantContext::class)->schoolId(),
                'text' => $data['text'] ?? null,
                'submitted_at' => now(),
                'status' => $late ? 'late' : 'submitted',
                'excuse' => $late ? ($data['excuse'] ?? null) : null,
            ],
        );

        if ($request->hasFile('file')) {
            $file = $request->file('file');
            $submission->update([
                'file_name' => $file->getClientOriginalName(),
                'file_path' => $file->store('submissions', 'private'),
                'mime_type' => $file->getMimeType(),
                'size' => $file->getSize(),
            ]);
        }

        AuditLogger::log('assignment.submitted', $submission);

        \App\Services\NotificationService::assignmentSubmitted($assignment, $submission, $late);

        return response()->json(['data' => $submission], 201);
    }

    public function grade(Request $request, Assignment $assignment, \App\Models\AssignmentSubmission $submission)
    {
        Gate::authorize('grade', $assignment);

        $data = $request->validate([
            'grade' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'feedback' => ['nullable', 'string', 'max:2000'],
        ]);

        $submission->update([
            'grade' => $data['grade'] ?? null,
            'feedback' => $data['feedback'] ?? null,
            'status' => $data['grade'] !== null ? 'graded' : $submission->status,
        ]);

        AuditLogger::log('assignment.graded', $submission, null, $data);

        return response()->json(['data' => $submission]);
    }

    public function downloadAttachment(Request $request, \App\Models\AssignmentAttachment $attachment)
    {
        Gate::authorize('view', $attachment->assignment);

        $path = $attachment->path;

        if (! Storage::disk('private')->exists($path)) {
            abort(404);
        }

        return Storage::disk('private')->download($path, $attachment->name);
    }

    public function downloadSubmission(Request $request, \App\Models\AssignmentSubmission $submission)
    {
        Gate::authorize('grade', $submission->assignment);

        if (! $submission->file_path || ! Storage::disk('private')->exists($submission->file_path)) {
            abort(404);
        }

        return Storage::disk('private')->download($submission->file_path, $submission->file_name ?? 'submission');
    }

    protected function closeExpired(): void
    {
        Assignment::query()
            ->where('status', 'published')
            ->where('due_date', '<=', today()->toDateString())
            ->get()
            ->filter(fn (Assignment $assignment) => $assignment->deadlinePassed())
            ->each(function (Assignment $assignment) {
                $assignment->update(['status' => 'closed']);
                AuditLogger::log('assignment.closed', $assignment);
            });
    }
}
