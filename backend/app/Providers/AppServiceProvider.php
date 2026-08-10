<?php

namespace App\Providers;

use App\Models\Announcement;
use App\Models\AttendanceRecord;
use App\Models\Assignment;
use App\Models\ExamSubject;
use App\Models\FeePayment;
use App\Models\Guardian;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\StudentFee;
use App\Models\Teacher;
use App\Policies\AnnouncementPolicy;
use App\Policies\AttendanceRecordPolicy;
use App\Policies\AssignmentPolicy;
use App\Policies\ExamSubjectPolicy;
use App\Policies\FeePaymentPolicy;
use App\Policies\GuardianPolicy;
use App\Policies\SchoolClassPolicy;
use App\Policies\StudentFeePolicy;
use App\Policies\StudentPolicy;
use App\Policies\TeacherPolicy;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Gate::before(function ($user, $ability) {
            if ($user->hasRole('super_admin')) {
                return true;
            }
        });

        \Illuminate\Support\Facades\RateLimiter::for('login', function ($request) {
            return \Illuminate\Cache\RateLimiting\Limit::perMinute(5)->by($request->ip());
        });

        \Illuminate\Support\Facades\RateLimiter::for('password', function ($request) {
            return \Illuminate\Cache\RateLimiting\Limit::perMinutes(10, 3)->by($request->ip());
        });

        \Illuminate\Support\Facades\RateLimiter::for('setup', function ($request) {
            return \Illuminate\Cache\RateLimiting\Limit::perHour(10)->by($request->ip());
        });

        \Illuminate\Support\Facades\RateLimiter::for('api', function ($request) {
            if ($request->user()) {
                return \Illuminate\Cache\RateLimiting\Limit::perMinute(300)->by($request->user()->id);
            }

            return \Illuminate\Cache\RateLimiting\Limit::perMinute(60)->by($request->ip());
        });

        Gate::policy(Student::class, StudentPolicy::class);
        Gate::policy(Teacher::class, TeacherPolicy::class);
        Gate::policy(Guardian::class, GuardianPolicy::class);
        Gate::policy(SchoolClass::class, SchoolClassPolicy::class);
        Gate::policy(\App\Models\Grade::class, \App\Policies\GradePolicy::class);
        Gate::policy(\App\Models\Subject::class, \App\Policies\SubjectPolicy::class);
        Gate::policy(\App\Models\Timetable::class, \App\Policies\TimetablePolicy::class);
        Gate::policy(\App\Models\GradeScale::class, \App\Policies\GradeScalePolicy::class);
        Gate::policy(AttendanceRecord::class, AttendanceRecordPolicy::class);
        Gate::policy(ExamSubject::class, ExamSubjectPolicy::class);
        Gate::policy(\App\Models\Exam::class, \App\Policies\ExamPolicy::class);
        Gate::policy(Assignment::class, AssignmentPolicy::class);
        Gate::policy(StudentFee::class, StudentFeePolicy::class);
        Gate::policy(FeePayment::class, FeePaymentPolicy::class);
        Gate::policy(\App\Models\FeeType::class, \App\Policies\FeeTypePolicy::class);
        Gate::policy(Announcement::class, AnnouncementPolicy::class);
    }
}
