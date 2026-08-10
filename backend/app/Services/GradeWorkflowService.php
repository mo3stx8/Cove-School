<?php

namespace App\Services;

use App\Enums\GradeStatus;
use App\Models\ExamSubject;
use App\Models\School;
use App\Models\User;
use App\Support\AuditLogger;
use App\Support\TenantContext;
use Illuminate\Support\Facades\DB;

class GradeWorkflowService
{
    public function saveMarks(ExamSubject $examSubject, array $marks, User $actor): ExamSubject
    {
        DB::transaction(function () use ($examSubject, $marks, $actor) {
            foreach ($marks as $studentId => $mark) {
                $mark = is_numeric($mark) ? (float) $mark : null;

                if ($mark !== null && ($mark < 0 || $mark > $examSubject->full_marks)) {
                    continue;
                }

                $result = $examSubject->results()->updateOrCreate(
                    ['student_id' => $studentId],
                    [
                        'school_id' => app(TenantContext::class)->schoolId(),
                        'marks' => $mark,
                        'grade' => $mark !== null
                            ? GradeService::gradeFor(app(TenantContext::class)->schoolId(), GradeService::percentage($mark, $examSubject->full_marks))?->name
                            : null,
                        'status' => GradeStatus::Draft,
                    ],
                );

                AuditLogger::log('exam.marks_saved', $result, null, ['marks' => $mark]);
            }
        });

        return $examSubject->fresh('results');
    }

    public function transition(ExamSubject $examSubject, GradeStatus $to, User $actor): ExamSubject
    {
        $allowed = [
            GradeStatus::Draft->value => [GradeStatus::Submitted->value],
            GradeStatus::Submitted->value => [GradeStatus::Reviewed->value, GradeStatus::Draft->value],
            GradeStatus::Reviewed->value => [GradeStatus::Published->value, GradeStatus::Submitted->value],
            GradeStatus::Published->value => [],
        ];

        $current = $examSubject->status->value;

        if (! in_array($to->value, $allowed[$current] ?? [], true)) {
            throw new \InvalidArgumentException("Invalid grade workflow transition from {$current} to {$to->value}.");
        }

        $examSubject->status = $to;
        $examSubject->save();

        $examSubject->results()->update(['status' => $to]);

        AuditLogger::log("exam.grades_{$to->value}", $examSubject, ['status' => $current], ['status' => $to->value]);

        return $examSubject->fresh();
    }
}
