<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\AttendanceStatus;
use App\Http\Controllers\Controller;
use App\Models\School;
use App\Models\StudentFee;
use App\Support\TenantContext;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class DashboardController extends Controller
{
    public function overview(Request $request)
    {
        $user = $request->user();
        $school = app(TenantContext::class)->school();

        $data = match (true) {
            $user->hasRole('teacher') => $this->teacherDashboard($user),
            $user->hasRole('student') => $this->studentDashboard($user),
            $user->hasRole('parent') => $this->parentDashboard($user),
            $user->hasRole('accountant') => $this->accountantDashboard($school),
            $user->hasRole('admin') || $user->hasRole('super_admin') => $this->adminDashboard($school),
            default => abort(403, 'You do not have a role assigned.'),
        };

        return response()->json($data);
    }

    protected function adminDashboard(School $school): array
    {
        $today = now()->toDateString();
        $academicYearId = $school->current_academic_year_id;

        $totalStudents = $school->students()->where('status', 'active')->count();
        $totalTeachers = $school->teachers()->where('status', 'active')->count();
        $totalClasses = $school->classes()->where('is_active', true)->count();

        $attendanceToday = $school->attendanceSessions()->where('date', $today)->first();

        $attendanceTodayRate = null;
        $absentToday = 0;

        if ($attendanceToday) {
            $records = $attendanceToday->records;
            $total = max(1, $records->count());
            $present = $records->whereIn('status', [AttendanceStatus::Present->value, AttendanceStatus::Late->value])->count();
            $attendanceTodayRate = round(($present / $total) * 100, 1);
            $absentToday = $records->where('status', AttendanceStatus::Absent->value)->count();
        }

        $studentsByGrade = $school->classes()
            ->with('grade')
            ->get()
            ->groupBy('grade.name')
            ->map(fn ($classes) => $classes->sum(fn ($c) => $c->students()->where('status', 'active')->count()));

        $upcomingExams = $school->exams()
            ->whereDate('start_date', '>=', today())
            ->orderBy('start_date')
            ->limit(5)
            ->get();

        $pendingFees = StudentFee::forSchool($school->id)
            ->where('status', '!=', 'paid')
            ->where('status', '!=', 'cancelled')
            ->sum('amount');

        $recentPayments = $school->feePayments()->with('student')->latest('paid_at')->limit(5)->get();
        $recentAnnouncements = $school->announcements()->where('status', 'published')->latest('published_at')->limit(5)->get();
        $recentActivity = $school->auditLogs()->latest('created_at')->limit(5)->get();

        return [
            'role' => 'admin',
            'stats' => [
                'total_students' => $totalStudents,
                'total_teachers' => $totalTeachers,
                'total_classes' => $totalClasses,
                'attendance_today_rate' => $attendanceTodayRate,
                'absent_today' => $absentToday,
                'pending_fees_amount' => round($pendingFees, 2),
            ],
            'students_by_grade' => $studentsByGrade,
            'upcoming_exams' => $upcomingExams,
            'recent_payments' => $recentPayments->map(fn ($p) => [
                'id' => $p->id,
                'receipt_number' => $p->receipt_number,
                'student' => $p->student?->fullName(),
                'amount' => $p->amount,
                'paid_at' => $p->paid_at?->toISOString(),
            ]),
            'recent_announcements' => $recentAnnouncements,
            'recent_activity' => $recentActivity->map(fn ($l) => [
                'action' => $l->action,
                'user' => $l->user?->name,
                'created_at' => $l->created_at?->toISOString(),
            ]),
        ];
    }

    protected function teacherDashboard($user): array
    {
        $teacher = $user->teacher;
        $classes = $user->teacher?->classSubjects()->with(['class', 'subject'])->get()
            ->groupBy('class_id')
            ->map(fn ($rows) => [
                'class_id' => $rows->first()->class_id,
                'class_name' => $rows->first()->class->name ?? null,
                'subjects' => $rows->map(fn ($r) => [
                    'id' => $r->subject_id,
                    'name' => $r->subject->name ?? null,
                ])->values(),
            ])->values();

        $today = now()->toDateString();

        $todaysClasses = $classes->map(function ($class) use ($teacher, $today) {
            $session = \App\Models\AttendanceSession::where('class_id', $class['class_id'])
                ->where('date', $today)
                ->first();

            return [
                'class_id' => $class['class_id'],
                'class_name' => $class['class_name'],
                'subjects' => $class['subjects'],
                'attendance_taken' => $session !== null,
            ];
        });

        return [
            'role' => 'teacher',
            'classes' => $classes,
            'todays_classes' => $todaysClasses,
        ];
    }

    protected function studentDashboard($user): array
    {
        $student = $user->student;

        if (! $student) {
            return ['role' => 'student', 'stats' => [], 'message' => 'No student profile linked.'];
        }

        $student->load('class.grade', 'class.timetables');

        $today = now()->toDateString();

        $timetable = $student->class?->timetables()->where('is_active', true)->first();
        $todaysPeriods = $timetable?->entries()->where('day_of_week', now()->dayOfWeekIso % 7)->orderBy('period_number')->get();

        $pendingAssignments = $student->class?->assignments()
            ->where('due_date', '>=', $today)
            ->whereDoesntHave('submissions', fn ($q) => $q->where('student_id', $student->id))
            ->count();

        $attendanceRate = $student->attendanceRate();

        $latestResult = $student->examResults()
            ->with('examSubject.subject')
            ->where('status', 'published')
            ->latest()
            ->first();

        return [
            'role' => 'student',
            'student' => [
                'id' => $student->id,
                'name' => $student->fullName(),
                'class_name' => $student->class?->name,
                'attendance_rate' => $attendanceRate,
                'pending_assignments' => $pendingAssignments,
            ],
            'todays_periods' => $todaysPeriods?->map(fn ($e) => [
                'period_number' => $e->period_number,
                'start_time' => $e->start_time?->format('H:i'),
                'end_time' => $e->end_time?->format('H:i'),
                'subject' => $e->subject?->name,
                'room' => $e->room,
            ]),
            'latest_result' => $latestResult ? [
                'subject' => $latestResult->examSubject?->subject?->name,
                'marks' => $latestResult->marks,
                'grade' => $latestResult->grade,
                'full_marks' => $latestResult->examSubject?->full_marks,
            ] : null,
        ];
    }

    protected function parentDashboard($user): array
    {
        $children = $user->guardians()->first()?->students()
            ->with('class.grade')
            ->get() ?? collect();

        return [
            'role' => 'parent',
            'children' => $children->map(function ($student) {
                return [
                    'id' => $student->id,
                    'name' => $student->fullName(),
                    'class_name' => $student->class?->name,
                    'attendance_rate' => $student->attendanceRate(),
                    'pending_assignments' => $student->class?->assignments()
                        ->where('due_date', '>=', today()->toDateString())
                        ->whereDoesntHave('submissions', fn ($q) => $q->where('student_id', $student->id))
                        ->count(),
                    'outstanding_fees' => $student->studentFees()
                        ->where('status', '!=', 'paid')
                        ->where('status', '!=', 'cancelled')
                        ->get()
                        ->sum(fn ($f) => $f->outstandingAmount()),
                ];
            }),
        ];
    }

    protected function accountantDashboard(School $school): array
    {
        $collectedThisMonth = $school->feePayments()
            ->whereBetween('paid_at', [now()->startOfMonth(), now()->endOfMonth()])
            ->sum('amount');

        $outstanding = StudentFee::forSchool($school->id)
            ->where('status', '!=', 'paid')
            ->where('status', '!=', 'cancelled')
            ->get()
            ->sum(fn ($f) => $f->outstandingAmount());

        $recentPayments = $school->feePayments()->with('student')->latest('paid_at')->limit(8)->get();

        return [
            'role' => 'accountant',
            'stats' => [
                'collected_this_month' => round($collectedThisMonth, 2),
                'outstanding_total' => round($outstanding, 2),
            ],
            'recent_payments' => $recentPayments->map(fn ($p) => [
                'id' => $p->id,
                'receipt_number' => $p->receipt_number,
                'student' => $p->student?->fullName(),
                'amount' => $p->amount,
                'method' => $p->payment_method->value,
                'paid_at' => $p->paid_at?->toISOString(),
            ]),
        ];
    }
}
