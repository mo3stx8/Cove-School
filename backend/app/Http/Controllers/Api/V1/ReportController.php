<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\AttendanceStatus;
use App\Http\Controllers\Controller;
use App\Models\Exam;
use App\Models\Student;
use App\Models\StudentFee;
use App\Services\ReportCardService;
use App\Support\TenantContext;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    public function __construct(private readonly ReportCardService $reportCards) {}

    // ---- Students ----

    public function students(Request $request)
    {
        Gate::authorize('viewAny', \App\Models\Student::class);

        $school = app(TenantContext::class)->school();

        $data = [
            'total' => $school->students()->count(),
            'active' => $school->students()->where('status', 'active')->count(),
            'inactive' => $school->students()->where('status', 'inactive')->count(),
            'archived' => $school->students()->where('status', 'archived')->count(),
            'by_grade' => $school->classes()->with('grade')->get()
                ->map(fn ($c) => [
                    'name' => $c->grade->name ?? 'Ungraded',
                    'name_ar' => $c->grade->name_ar ?? null,
                    'count' => $c->students()->where('status', 'active')->count(),
                ])
                ->groupBy('name')
                ->map(fn ($items, $name) => [
                    'name' => $name,
                    'name_ar' => $items->first()['name_ar'],
                    'count' => $items->sum('count'),
                ])
                ->values(),
            'new_admissions_this_month' => $school->students()->where('enrollment_date', '>=', now()->startOfMonth())->count(),
        ];

        return response()->json(['data' => $data]);
    }

    // ---- Attendance ----

    public function attendance(Request $request)
    {
        $user = $request->user();
        abort_unless($user->isStaff() && $user->hasPermissionTo('attendance.view'), 403);

        $data = $request->validate([
            'from' => ['required', 'date'],
            'to' => ['required', 'date', 'after_or_equal:from'],
            'class_id' => ['nullable', 'exists:classes,id'],
            'student_id' => ['nullable', 'exists:students,id'],
        ]);

        $query = \App\Models\AttendanceRecord::query()
            ->with(['student'])
            ->whereHas('session', fn ($s) => $s
                ->when($data['class_id'] ?? null, fn ($q, $cid) => $q->where('class_id', $cid))
                ->where('date', '>=', $data['from'])
                ->where('date', '<=', $data['to']));

        if (! empty($data['student_id'])) {
            $query->where('student_id', $data['student_id']);
        }

        $records = $query->get();

        $summary = [
            'present' => $records->where('status', AttendanceStatus::Present->value)->count(),
            'absent' => $records->where('status', AttendanceStatus::Absent->value)->count(),
            'late' => $records->where('status', AttendanceStatus::Late->value)->count(),
            'excused' => $records->where('status', AttendanceStatus::Excused->value)->count(),
            'rate' => $records->isEmpty() ? 0 : round(
                ($records->whereIn('status', [AttendanceStatus::Present->value, AttendanceStatus::Late->value])->count() / $records->count()) * 100, 2
            ),
        ];

        $byDay = $records->groupBy(fn ($r) => $r->session?->date->toDateString())->map(fn ($day) => [
            'date' => $day->first()->session?->date->toDateString(),
            'present' => $day->where('status', AttendanceStatus::Present->value)->count(),
            'absent' => $day->where('status', AttendanceStatus::Absent->value)->count(),
        ])->values();

        return response()->json(['summary' => $summary, 'by_day' => $byDay]);
    }

    // ---- Academic ----

    public function academic(Request $request)
    {
        $user = $request->user();
        abort_unless($user->isStaff() && $user->hasPermissionTo('reports.view'), 403);

        $data = $request->validate([
            'exam_id' => ['sometimes', 'exists:exams,id'],
            'class_id' => ['sometimes', 'exists:classes,id'],
        ]);

        $query = \App\Models\ExamSubject::query()
            ->where('status', \App\Enums\GradeStatus::Published)
            ->with(['exam', 'subject', 'class.grade', 'results'])
            ->when($data['exam_id'] ?? null, fn ($q, $id) => $q->where('exam_id', $id))
            ->when($data['class_id'] ?? null, fn ($q, $id) => $q->where('class_id', $id));

        $subjects = $query->get();

        $subjectAverages = $subjects->map(function ($es) {
            $marks = $es->results->pluck('marks')->filter();

            return [
                'name' => $es->subject?->name,
                'name_ar' => $es->subject?->name_ar,
                'class' => $es->class?->name,
                'class_ar' => $es->class?->name_ar,
                'grade' => $es->class?->grade?->name,
                'grade_ar' => $es->class?->grade?->name_ar,
                'exam' => $es->exam?->name,
                'average' => $marks->isEmpty() ? 0 : round($marks->avg(), 2),
                'full_marks' => $es->full_marks,
                'students' => $marks->count(),
            ];
        });

        return response()->json(['subject_averages' => $subjectAverages]);
    }

    // ---- Finance ----

    public function finance(Request $request)
    {
        $user = $request->user();
        abort_unless($user->isStaff() && $user->hasPermissionTo('reports.view'), 403);

        $school = app(TenantContext::class)->school();

        $data = $request->validate([
            'from' => ['sometimes', 'date'],
            'to' => ['sometimes', 'date', 'after_or_equal:from'],
        ]);

        $paymentsQuery = $school->feePayments()
            ->when($data['from'] ?? null, fn ($q, $from) => $q->whereDate('paid_at', '>=', $from))
            ->when($data['to'] ?? null, fn ($q, $to) => $q->whereDate('paid_at', '<=', $to));

        $invoices = \App\Models\StudentFee::query()->where('status', '!=', 'cancelled')->get();

        return response()->json([
            'collected' => round($paymentsQuery->sum('amount'), 2),
            'invoiced' => round($invoices->sum('amount'), 2),
            'outstanding' => round($invoices->sum(fn ($f) => $f->outstandingAmount()), 2),
            'discounted' => round($invoices->sum('discount_amount'), 2),
            'payments_count' => $paymentsQuery->count(),
        ]);
    }

    // ---- Exports ----

    public function exportCsv(Request $request)
    {
        Gate::authorize('viewAny', \App\Models\Student::class);

        $user = $request->user();
        abort_unless($user->isStaff(), 403);

        $data = $request->validate([
            'type' => ['required', 'in:students,payments,attendance'],
        ]);

        $type = $data['type'];

        $allowed = match ($type) {
            'students' => ['students.view', 'reports.view'],
            'payments' => ['payments.view', 'reports.view'],
            'attendance' => ['attendance.view', 'reports.view'],
        };
        abort_unless($user->hasAnyPermission($allowed), 403);

        $filename = match ($type) {
            'students' => 'students.csv',
            'payments' => 'payments.csv',
            'attendance' => 'attendance.csv',
        };

        return new StreamedResponse(function () use ($type) {
            $handle = fopen('php://output', 'w');

            match ($type) {
                'students' => $this->exportStudents($handle),
                'payments' => $this->exportPayments($handle),
                'attendance' => $this->exportAttendance($handle),
            };

            fclose($handle);
        }, 200, [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => "attachment; filename={$filename}",
        ]);
    }

    protected function exportStudents($handle): void
    {
        fputcsv($handle, ['Student Number', 'Name', 'Class', 'Gender', 'Status', 'Enrollment Date']);

        \App\Models\Student::query()->with('class')->chunk(200, function ($students) use ($handle) {
            foreach ($students as $student) {
                fputcsv($handle, [
                    $student->student_number,
                    $student->fullName(),
                    $student->class?->name,
                    $student->gender,
                    $student->status->value,
                    $student->enrollment_date?->toDateString(),
                ]);
            }
        });
    }

    protected function exportPayments($handle): void
    {
        fputcsv($handle, ['Receipt', 'Student', 'Amount', 'Method', 'Date']);

        app(TenantContext::class)->school()->feePayments()
            ->with('student')
            ->chunk(200, function ($payments) use ($handle) {
                foreach ($payments as $p) {
                    fputcsv($handle, [
                        $p->receipt_number,
                        $p->student?->fullName(),
                        $p->amount,
                        $p->payment_method->value,
                        $p->paid_at?->toDateTimeString(),
                    ]);
                }
            });
    }

    protected function exportAttendance($handle): void
    {
        fputcsv($handle, ['Date', 'Class', 'Student', 'Status']);

        \App\Models\AttendanceRecord::query()
            ->with(['session.class', 'student'])
            ->chunk(200, function ($records) use ($handle) {
                foreach ($records as $r) {
                    fputcsv($handle, [
                        $r->session?->date?->toDateString(),
                        $r->session?->class?->name,
                        $r->student?->fullName(),
                        $r->status->value,
                    ]);
                }
            });
    }

    // ---- Report cards ----

    public function reportCard(Request $request, Student $student)
    {
        Gate::authorize('view', $student);

        $data = $request->validate([
            'exam_id' => ['sometimes', 'exists:exams,id'],
            'term_id' => ['sometimes', 'exists:terms,id'],
        ]);

        $report = $this->reportCards->forStudent($student, $data['exam_id'] ?? null, $data['term_id'] ?? null);

        return response()->json(['data' => $report]);
    }

    public function reportCardPdf(Request $request, Student $student)
    {
        Gate::authorize('view', $student);

        $data = $request->validate([
            'exam_id' => ['sometimes', 'exists:exams,id'],
            'term_id' => ['sometimes', 'exists:terms,id'],
        ]);

        $report = $this->reportCards->forStudent($student, $data['exam_id'] ?? null, $data['term_id'] ?? null);
        $school = app(TenantContext::class)->school();

        $pdf = Pdf::loadView('pdf.report-card', [
            'school' => $school,
            'report' => $report,
        ])->setPaper('a4');

        return $pdf->download('report-card-'.str_replace(' ', '-', $student->fullName()).'.pdf');
    }
}
