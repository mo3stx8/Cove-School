<?php

use App\Http\Controllers\Api\V1\AcademicController;
use App\Http\Controllers\Api\V1\AnnouncementController;
use App\Http\Controllers\Api\V1\AssignmentController;
use App\Http\Controllers\Api\V1\AttendanceController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\DashboardController;
use App\Http\Controllers\Api\V1\EmailController;
use App\Http\Controllers\Api\V1\ExamController;
use App\Http\Controllers\Api\V1\FeeController;
use App\Http\Controllers\Api\V1\GuardianController;
use App\Http\Controllers\Api\V1\NotificationController;
use App\Http\Controllers\Api\V1\ReportController;
use App\Http\Controllers\Api\V1\SchoolClassController;
use App\Http\Controllers\Api\V1\SetupController;
use App\Http\Controllers\Api\V1\StudentController;
use App\Http\Controllers\Api\V1\TeacherController;
use App\Http\Controllers\Api\V1\TimetableController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->middleware('throttle:api')->group(function () {

    // Public
    Route::post('auth/login', [AuthController::class, 'login'])->middleware('throttle:login');
    Route::post('auth/activate', [AuthController::class, 'activate'])->middleware('throttle:password');
    Route::post('auth/forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:password');
    Route::post('auth/reset-password', [AuthController::class, 'resetPassword'])->middleware('throttle:password');

    Route::post('setup/register', [SetupController::class, 'register'])->middleware('throttle:setup');

    // Authenticated
    Route::middleware('auth:sanctum')->group(function () {

        Route::post('auth/logout', [AuthController::class, 'logout']);
        Route::get('auth/me', [AuthController::class, 'me']);
        Route::put('auth/profile', [AuthController::class, 'updateProfile']);
        Route::put('auth/password', [AuthController::class, 'changePassword']);
        Route::post('auth/activation/resend', [AuthController::class, 'resendActivation']);

        Route::get('setup/progress', [SetupController::class, 'progress']);
        Route::put('setup/school', [SetupController::class, 'updateSchool']);
        Route::post('setup/academic-year', [SetupController::class, 'createAcademicYear']);

        Route::get('dashboard', [DashboardController::class, 'overview']);

        // Academic
        Route::get('academic-years', [AcademicController::class, 'academicYears']);
        Route::post('academic-years', [AcademicController::class, 'storeAcademicYear']);
        Route::put('academic-years/{academicYear}', [AcademicController::class, 'updateAcademicYear']);
        Route::post('academic-years/{academicYear}/set-current', [AcademicController::class, 'setCurrentAcademicYear']);
        Route::get('academic-years/{academicYear}/terms', [AcademicController::class, 'terms']);
        Route::post('academic-years/{academicYear}/terms', [AcademicController::class, 'storeTerm']);
        Route::put('terms/{term}', [AcademicController::class, 'updateTerm']);

        Route::get('grades', [AcademicController::class, 'grades']);
        Route::post('grades', [AcademicController::class, 'storeGrade']);
        Route::put('grades/{grade}', [AcademicController::class, 'updateGrade']);

        Route::get('subjects', [AcademicController::class, 'subjects']);
        Route::post('subjects', [AcademicController::class, 'storeSubject']);
        Route::put('subjects/{subject}', [AcademicController::class, 'updateSubject']);

        Route::get('grade-scales', [AcademicController::class, 'gradeScales']);
        Route::post('grade-scales', [AcademicController::class, 'storeGradeScale']);

        // Classes
        Route::get('classes', [SchoolClassController::class, 'index']);
        Route::post('classes', [SchoolClassController::class, 'store']);
        Route::get('classes/{class}', [SchoolClassController::class, 'show']);
        Route::put('classes/{class}', [SchoolClassController::class, 'update']);
        Route::delete('classes/{class}', [SchoolClassController::class, 'destroy']);
        Route::post('classes/{class}/subjects', [SchoolClassController::class, 'assignSubjects']);
        Route::post('classes/{class}/assign-students', [SchoolClassController::class, 'assignStudents']);

        // Guardians
        Route::get('guardians/check', [GuardianController::class, 'check']);

        // Real-email owner lookup (duplicate detection)
        Route::get('emails/check', [EmailController::class, 'check']);

        // Students
        Route::get('students', [StudentController::class, 'index']);
        Route::post('students', [StudentController::class, 'store']);
        Route::get('students/{student}', [StudentController::class, 'show']);
        Route::put('students/{student}', [StudentController::class, 'update']);
        Route::post('students/{student}/archive', [StudentController::class, 'archive']);
        Route::post('students/{student}/restore', [StudentController::class, 'restore']);
        Route::post('students/{student}/assign-class', [StudentController::class, 'assignClass']);

        // Teachers
        Route::get('teachers', [TeacherController::class, 'index']);
        Route::post('teachers', [TeacherController::class, 'store']);
        Route::get('teachers/{teacher}', [TeacherController::class, 'show']);
        Route::put('teachers/{teacher}', [TeacherController::class, 'update']);
        Route::post('teachers/{teacher}/archive', [TeacherController::class, 'archive']);
        Route::post('teachers/{teacher}/restore', [TeacherController::class, 'restore']);

        // Timetables
        Route::get('timetables', [TimetableController::class, 'index']);
        Route::get('classes/{class}/timetables', [TimetableController::class, 'index']);
        Route::post('timetables', [TimetableController::class, 'store']);
        Route::post('timetables/{timetable}/entries', [TimetableController::class, 'addEntry']);
        Route::delete('timetable-entries/{entry}', [TimetableController::class, 'destroyEntry']);

        // Attendance
        Route::get('classes/{class}/attendance', [AttendanceController::class, 'grid']);
        Route::post('classes/{class}/attendance', [AttendanceController::class, 'take']);
        Route::get('attendance/sessions/{session}', [AttendanceController::class, 'session']);
        Route::post('attendance/records/{record}/correction', [AttendanceController::class, 'requestCorrection']);
        Route::get('attendance/corrections', [AttendanceController::class, 'corrections']);
        Route::post('attendance/corrections/{correction}/review', [AttendanceController::class, 'reviewCorrection']);

        // Exams & Grades
        Route::get('exams', [ExamController::class, 'index']);
        Route::post('exams', [ExamController::class, 'store']);
        Route::get('exams/{exam}', [ExamController::class, 'show']);
        Route::put('exams/{exam}', [ExamController::class, 'update']);
        Route::get('exam-subjects/{examSubject}', [ExamController::class, 'examSubject']);
        Route::post('exam-subjects/{examSubject}/marks', [ExamController::class, 'saveMarks']);
        Route::post('exam-subjects/{examSubject}/submit', [ExamController::class, 'submitGrades']);
        Route::post('exam-subjects/{examSubject}/review', [ExamController::class, 'reviewGrades']);
        Route::post('exam-subjects/{examSubject}/publish', [ExamController::class, 'publishGrades']);
        Route::post('exam-results/{examResult}/correction', [ExamController::class, 'requestCorrection']);
        Route::get('exam-corrections', [ExamController::class, 'corrections']);
        Route::post('exam-corrections/{correction}/review', [ExamController::class, 'reviewCorrection']);

        // Assignments
        Route::get('assignments', [AssignmentController::class, 'index']);
        Route::post('assignments', [AssignmentController::class, 'store']);
        Route::get('assignments/{assignment}', [AssignmentController::class, 'show']);
        Route::put('assignments/{assignment}', [AssignmentController::class, 'update']);
        Route::post('assignments/{assignment}/submit', [AssignmentController::class, 'submit']);
        Route::post('assignments/{assignment}/submissions/{submission}/grade', [AssignmentController::class, 'grade']);
        Route::delete('assignments/{assignment}', [AssignmentController::class, 'destroy']);
        Route::get('assignment-attachments/{attachment}/download', [AssignmentController::class, 'downloadAttachment']);
        Route::get('assignment-submissions/{submission}/download', [AssignmentController::class, 'downloadSubmission']);

        // Fees
        Route::get('fee-types', [FeeController::class, 'feeTypes']);
        Route::post('fee-types', [FeeController::class, 'storeFeeType']);
        Route::put('fee-types/{feeType}', [FeeController::class, 'updateFeeType']);
        Route::delete('fee-types/{feeType}', [FeeController::class, 'destroyFeeType']);

        Route::get('invoices', [FeeController::class, 'invoices']);
        Route::post('invoices', [FeeController::class, 'storeInvoice']);
        Route::get('invoices/{studentFee}', [FeeController::class, 'invoice']);
        Route::put('invoices/{studentFee}', [FeeController::class, 'updateInvoice']);
        Route::post('invoices/{studentFee}/cancel', [FeeController::class, 'cancelInvoice']);
        Route::post('invoices/{studentFee}/pay', [FeeController::class, 'recordPayment']);

        Route::get('payments', [FeeController::class, 'payments']);
        Route::get('payments/{payment}/receipt', [FeeController::class, 'receipt']);
        Route::get('payments/{payment}/receipt.pdf', [FeeController::class, 'receiptPdf']);

        Route::get('fees/summary', [FeeController::class, 'summary']);

        // Announcements
        Route::get('announcements', [AnnouncementController::class, 'index']);
        Route::post('announcements', [AnnouncementController::class, 'store']);
        Route::put('announcements/{announcement}', [AnnouncementController::class, 'update']);
        Route::delete('announcements/{announcement}', [AnnouncementController::class, 'destroy']);

        // Notifications
        Route::get('notifications', [NotificationController::class, 'index']);
        Route::get('notifications/unread-count', [NotificationController::class, 'unreadCount']);
        Route::post('notifications/{notification}/read', [NotificationController::class, 'markRead']);
        Route::post('notifications/read-all', [NotificationController::class, 'markAllRead']);

        // Reports
        Route::get('reports/students', [ReportController::class, 'students']);
        Route::get('reports/attendance', [ReportController::class, 'attendance']);
        Route::get('reports/academic', [ReportController::class, 'academic']);
        Route::get('reports/finance', [ReportController::class, 'finance']);
        Route::get('reports/export.csv', [ReportController::class, 'exportCsv']);

        Route::get('students/{student}/report-card', [ReportController::class, 'reportCard']);
        Route::get('students/{student}/report-card.pdf', [ReportController::class, 'reportCardPdf']);
    });
});
