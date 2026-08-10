<?php

namespace App\Services;

use App\Enums\AttendanceStatus;
use App\Models\AttendanceRecord;
use App\Models\AttendanceSession;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\User;
use App\Support\AuditLogger;
use App\Support\TenantContext;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class AttendanceService
{
    /**
     * Record (or update) attendance for a class on a date.
     *
     * @param  array<string,string>  $records  student_id => status
     */
    public function record(
        SchoolClass $class,
        string $date,
        array $records,
        User $actor,
        ?int $period = null,
        ?int $subjectId = null,
    ): AttendanceSession {
        return DB::transaction(function () use ($class, $date, $records, $actor, $period, $subjectId) {
            $school = app(TenantContext::class)->school();

            $session = AttendanceSession::updateOrCreate(
                [
                    'school_id' => $school->id,
                    'class_id' => $class->id,
                    'date' => $date,
                    'period' => $period,
                ],
                [
                    'academic_year_id' => $school->current_academic_year_id,
                    'subject_id' => $subjectId,
                    'taken_by' => $actor->id,
                    'notes' => null,
                ],
            );

            $validStatuses = collect(AttendanceStatus::cases())->map(fn ($s) => $s->value);

            foreach ($records as $studentId => $status) {
                if (! $validStatuses->contains($status)) {
                    continue;
                }

                AttendanceRecord::updateOrCreate(
                    ['attendance_session_id' => $session->id, 'student_id' => $studentId],
                    ['school_id' => $session->school_id, 'status' => $status, 'marked_by' => $actor->id],
                );
            }

            AuditLogger::log('attendance.recorded', $session, null, ['records' => $records]);

            return $session->fresh('records');
        });
    }

    /**
     * Roll up per-student statuses for a class/date (used by the teacher grid).
     *
     * @return array{student_id: int, status: string|null, name: string, student_number: string}
     */
    public function grid(SchoolClass $class, string $date, ?int $period = null): Collection
    {
        $session = AttendanceSession::where('class_id', $class->id)
            ->where('date', $date)
            ->where('period', $period)
            ->first();

        $existing = $session?->records->keyBy('student_id') ?? collect();

        return $class->students()->with('user')->get()->map(function (Student $student) use ($existing) {
            $record = $existing->get($student->id);

            return [
                'student_id' => $student->id,
                'name' => $student->fullName(),
                'student_number' => $student->student_number,
                'status' => $record?->status->value ?? null,
            ];
        });
    }

    public function requestCorrection(AttendanceRecord $record, string $newStatus, string $reason, User $requester): void
    {
        DB::transaction(function () use ($record, $newStatus, $reason, $requester) {
            $school = app(TenantContext::class)->school();

            $record->corrections()->create([
                'school_id' => $school->id,
                'requested_by' => $requester->id,
                'old_status' => $record->status->value,
                'new_status' => $newStatus,
                'reason' => $reason,
                'status' => 'pending',
            ]);

            AuditLogger::log('attendance.correction_requested', $record, ['status' => $record->status->value], ['status' => $newStatus], $reason);
        });
    }

    public function approveCorrection(\App\Models\AttendanceCorrection $correction, User $reviewer, bool $approve): void
    {
        DB::transaction(function () use ($correction, $reviewer, $approve) {
            $correction->update([
                'status' => $approve ? 'approved' : 'rejected',
                'reviewed_by' => $reviewer->id,
                'reviewed_at' => now(),
            ]);

            if ($approve) {
                $correction->record->update(['status' => $correction->new_status]);
            }

            AuditLogger::log(
                'attendance.correction_'.($approve ? 'approved' : 'rejected'),
                $correction->record,
                ['status' => $correction->old_status],
                ['status' => $correction->new_status],
            );
        });
    }
}
