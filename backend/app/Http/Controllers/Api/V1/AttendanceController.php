<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\AttendanceStatus;
use App\Http\Controllers\Controller;
use App\Models\AttendanceCorrection;
use App\Models\AttendanceSession;
use App\Models\SchoolClass;
use App\Services\AttendanceService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class AttendanceController extends Controller
{
    public function __construct(private readonly AttendanceService $attendance) {}

    public function grid(Request $request, SchoolClass $class)
    {
        Gate::authorize('view', $class);

        $data = $request->validate([
            'date' => ['required', 'date'],
            'period' => ['nullable', 'integer', 'min:0', 'max:20'],
        ]);

        $grid = $this->attendance->grid($class, $data['date'], $data['period'] ?? null);

        return response()->json(['data' => $grid]);
    }

    public function take(Request $request, SchoolClass $class)
    {
        Gate::authorize('take', AttendanceRecord::class);

        $data = $request->validate([
            'date' => ['required', 'date'],
            'period' => ['nullable', 'integer', 'min:0', 'max:20'],
            'subject_id' => ['nullable', 'exists:subjects,id'],
            'records' => ['required', 'array'],
            'records.*' => ['required', 'in:present,absent,late,excused'],
        ]);

        $session = $this->attendance->record(
            $class,
            $data['date'],
            $data['records'],
            $request->user(),
            $data['period'] ?? null,
            $data['subject_id'] ?? null,
        );

        return response()->json(['data' => $session]);
    }

    public function session(Request $request, AttendanceSession $session)
    {
        Gate::authorize('view', $session->records->first() ?? new \App\Models\AttendanceRecord);

        $session->load(['records.student', 'class', 'subject', 'takenBy']);

        return response()->json([
            'data' => [
                'id' => $session->id,
                'class' => $session->class?->name,
                'date' => $session->date->toDateString(),
                'period' => $session->period,
                'subject' => $session->subject?->name,
                'taken_by' => $session->takenBy?->name,
                'records' => $session->records->map(fn ($r) => [
                    'id' => $r->id,
                    'student_id' => $r->student_id,
                    'name' => $r->student?->fullName(),
                    'status' => $r->status->value,
                    'notes' => $r->notes,
                ]),
            ],
        ]);
    }

    public function requestCorrection(Request $request, \App\Models\AttendanceRecord $record)
    {
        Gate::authorize('correct', $record);

        $data = $request->validate([
            'new_status' => ['required', 'in:present,absent,late,excused'],
            'reason' => ['required', 'string', 'max:1000'],
        ]);

        $this->attendance->requestCorrection($record, $data['new_status'], $data['reason'], $request->user());

        return response()->json(['message' => 'Correction request submitted for approval.']);
    }

    public function corrections(Request $request)
    {
        Gate::authorize('approveCorrections', \App\Models\AttendanceRecord::class);

        $corrections = AttendanceCorrection::query()
            ->where('status', 'pending')
            ->with(['record.student', 'requester'])
            ->latest()
            ->paginate($request->integer('per_page', 25));

        return response()->json(['data' => $corrections]);
    }

    public function reviewCorrection(Request $request, AttendanceCorrection $correction)
    {
        Gate::authorize('approveCorrections', \App\Models\AttendanceRecord::class);

        $data = $request->validate([
            'approve' => ['required', 'boolean'],
        ]);

        $this->attendance->approveCorrection($correction, $request->user(), $data['approve']);

        return response()->json(['message' => $data['approve'] ? 'Correction approved.' : 'Correction rejected.']);
    }

    public function report(Request $request)
    {
        Gate::authorize('view', \App\Models\AttendanceRecord::class);

        $data = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'class_id' => ['nullable', 'exists:classes,id'],
        ]);

        $query = \App\Models\AttendanceRecord::query()
            ->with(['student', 'session'])
            ->when($data['from'] ?? null, fn ($q, $from) => $q->whereHas('session', fn ($s) => $s->where('date', '>=', $from)))
            ->when($data['to'] ?? null, fn ($q, $to) => $q->whereHas('session', fn ($s) => $s->where('date', '<=', $to)))
            ->when($data['class_id'] ?? null, fn ($q, $cid) => $q->whereHas('session', fn ($s) => $s->where('class_id', $cid)));

        $records = $query->get();

        $summary = [
            'present' => $records->where('status', AttendanceStatus::Present->value)->count(),
            'absent' => $records->where('status', AttendanceStatus::Absent->value)->count(),
            'late' => $records->where('status', AttendanceStatus::Late->value)->count(),
            'excused' => $records->where('status', AttendanceStatus::Excused->value)->count(),
        ];

        return response()->json(['summary' => $summary]);
    }
}
