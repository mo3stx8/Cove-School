<?php

namespace App\Services;

use App\Enums\GradeStatus;
use App\Models\Exam;
use App\Models\ExamSubject;
use App\Models\School;
use App\Models\Student;

class ReportCardService
{
    public function forStudent(Student $student, ?int $examId = null, ?int $termId = null): array
    {
        $student->load('class.grade');

        $query = ExamSubject::query()
            ->where('class_id', $student->class_id)
            ->where('status', GradeStatus::Published)
            ->with(['exam', 'subject', 'results' => fn ($q) => $q->where('student_id', $student->id)->where('status', GradeStatus::Published)]);

        if ($examId) {
            $query->where('exam_id', $examId);
        } elseif ($termId) {
            $query->whereHas('exam', fn ($e) => $e->where('term_id', $termId));
        }

        $subjects = $query->get();

        $rows = $subjects->map(function (ExamSubject $examSubject) {
            $result = $examSubject->results->first();

            return [
                'exam_name' => $examSubject->exam?->name,
                'subject' => $examSubject->subject?->name,
                'full_marks' => $examSubject->full_marks,
                'marks' => $result?->marks,
                'grade' => $result?->grade,
                'percentage' => $result ? round(($result->marks / $examSubject->full_marks) * 100, 2) : null,
            ];
        })->values();

        $percentages = $rows->whereNotNull('percentage')->pluck('percentage')->all();

        return [
            'student' => [
                'id' => $student->id,
                'name' => $student->fullName(),
                'student_number' => $student->student_number,
                'class_name' => $student->class?->name,
                'gender' => $student->gender,
            ],
            'attendance_rate' => $student->attendanceRate(),
            'rows' => $rows,
            'average' => GradeService::average($percentages),
        ];
    }
}
