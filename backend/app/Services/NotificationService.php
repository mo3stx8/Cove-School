<?php

namespace App\Services;

use App\Models\Announcement;
use App\Models\Assignment;
use App\Models\AssignmentSubmission;
use App\Models\AttendanceCorrection;
use App\Models\ExamSubject;
use App\Models\Notification;
use App\Models\School;
use App\Models\Student;
use App\Models\User;

class NotificationService
{
    public static function create(int $userId, string $type, string $title, string $body = '', ?string $actionUrl = null): ?Notification
    {
        $user = User::find($userId);

        if (! $user) {
            return null;
        }

        return Notification::create([
            'school_id' => $user->school_id,
            'user_id' => $userId,
            'type' => $type,
            'title' => $title,
            'body' => $body,
            'action_url' => $actionUrl,
        ]);
    }

    public static function toUsers(iterable $userIds, string $type, string $title, string $body = '', ?string $actionUrl = null): void
    {
        foreach ($userIds as $id) {
            self::create((int) $id, $type, $title, $body, $actionUrl);
        }
    }

    public static function toSchoolAdmins(School $school, string $type, string $title, string $body = '', ?string $actionUrl = null): void
    {
        $ids = $school->users()
            ->whereHas('roles', fn ($q) => $q->whereIn('name', ['super_admin', 'admin']))
            ->pluck('id');

        self::toUsers($ids, $type, $title, $body, $actionUrl);
    }

    public static function toRole(School $school, string $role, string $type, string $title, string $body = '', ?string $actionUrl = null): void
    {
        $ids = $school->users()
            ->whereHas('roles', fn ($q) => $q->where('name', $role))
            ->pluck('id');

        self::toUsers($ids, $type, $title, $body, $actionUrl);
    }

    public static function toClassStudents(int $classId, string $type, string $title, string $body = '', ?string $actionUrl = null): void
    {
        $ids = Student::where('class_id', $classId)->pluck('user_id')->filter();

        self::toUsers($ids, $type, $title, $body, $actionUrl);
    }

    public static function attendanceCorrectionRequested(AttendanceCorrection $correction): void
    {
        $school = app(\App\Support\TenantContext::class)->school();
        if (! $school) {
            return;
        }

        $student = $correction->record?->student;
        $name = $student?->fullName() ?? 'a student';

        self::toSchoolAdmins($school, 'attendance.correction', 'Attendance correction requested',
            "{$name}: {$correction->old_status} → {$correction->new_status}. {$correction->reason}",
            '/attendance');
    }

    public static function attendanceCorrectionReviewed(AttendanceCorrection $correction, bool $approved): void
    {
        if ($correction->requested_by) {
            self::create($correction->requested_by, 'attendance.correction',
                $approved ? 'Correction approved' : 'Correction rejected',
                $approved ? 'Your attendance correction was approved.' : 'Your attendance correction was rejected.');
        }
    }

    public static function gradesPublished(ExamSubject $examSubject): void
    {
        self::toClassStudents($examSubject->class_id, 'exam.published', 'Results published',
            "{$examSubject->exam?->name} — {$examSubject->subject?->name} results are now published.",
            '/portal');
    }

    public static function announcementCreated(Announcement $announcement, School $school): void
    {
        $title = $announcement->title;
        $url = '/announcements';
        $audience = $announcement->audience?->value ?? $announcement->getRawOriginal('audience');

        switch ($audience) {
            case 'everyone':
                self::toUsers($school->users()->pluck('id'), 'announcement', $title, $announcement->body, $url);
                break;
            case 'teachers':
                self::toRole($school, 'teacher', 'announcement', $title, $announcement->body, $url);
                break;
            case 'students':
                self::toRole($school, 'student', 'announcement', $title, $announcement->body, $url);
                break;
            case 'parents':
                self::toRole($school, 'parent', 'announcement', $title, $announcement->body, $url);
                break;
            case 'class':
                if ($announcement->class_id) {
                    self::toClassStudents($announcement->class_id, 'announcement', $title, $announcement->body, $url);
                }
                break;
        }
    }

    public static function assignmentCreated(Assignment $assignment): void
    {
        $due = $assignment->due_date->format('Y-m-d');

        self::toClassStudents($assignment->class_id, 'assignment.created', 'New assignment',
            "{$assignment->title} — {$assignment->class?->name}, due {$due}",
            '/assignments');
    }

    public static function assignmentSubmitted(Assignment $assignment, AssignmentSubmission $submission, bool $late): void
    {
        if (! $assignment->teacher_id) {
            return;
        }

        $studentName = $submission->student?->fullName() ?? 'A student';
        $body = $late
            ? ($submission->excuse
                ? "{$studentName} submitted late. Excuse: {$submission->excuse}"
                : "{$studentName} submitted late.")
            : "{$studentName} submitted '{$assignment->title}'.";

        self::create($assignment->teacher_id, 'assignment.submitted',
            $late ? 'Late submission' : 'New submission', $body, '/assignments');
    }
}
