# Security Review Report — Phase 10 Hardening

**Project:** SiliconCove SMS
**Date:** 2026-08-11
**Scope:** Backend authorization/tenant isolation, file uploads, rate limiting, backups, performance, error handling, audit logging, mobile/accessibility.
**Method:** Source review + live curl verification against `:8000`, `pg_dump`/`pg_restore` round-trip, `EXPLAIN ANALYZE`, `composer audit` / `npm audit`.

---

## Summary

| Severity | Fixed | Residual |
|----------|-------|----------|
| Critical | 1     | 0        |
| High     | 8     | 0        |
| Medium   | 3     | 1        |
| Low      | 0     | 3        |

All code-level fixes below were applied and verified with curl (status codes noted). Residual items are configuration/design notes requiring deployment-time action or future work.

---

## Fixed Findings

### CRITICAL — Student directory disclosure to students/parents
- **OWASP Top 10:2025:** A01 Broken Access Control · **ASVS:** V4.1.2, V4.1.3
- **Location:** `app/Policies/StudentPolicy.php` (`viewAny`, `view`), seeder `database/seeders/RolesAndPermissionsSeeder.php:62-65`
- **Issue:** `student` and `parent` roles hold `students.view`. `viewAny` and the `view` permission fallback therefore granted any student/parent the full school directory (`GET /v1/students`) including guardian, document, and contact data for every student. `view` also allowed any record by id.
- **Fix:** `viewAny` denies student/parent roles; `view` is ownership-first (self / linked guardian) and only falls back to the `students.*` permissions for `isStaff()` users (`app/Models/User.php` helper). Verified: student→403, parent→403, teacher→200, admin→200.
- **Regression check:** student/parent portals use `/dashboard`, `/assignments`, `/invoices` — none require `/students` list; nav already restricts `/students` to admin/accountant.

### HIGH — Fee invoice IDOR for parents
- **OWASP A01** · **ASVS V4.2.1**
- **Location:** `app/Policies/StudentFeePolicy.php`, `app/Http/Controllers/Api/V1/FeeController.php:80`
- **Issue:** Parent holds `fees.view`; `view()` fell through to it, so a parent could open any invoice by id. `invoices()` returned all invoices for the school (frontend filtered client-side).
- **Fix:** `view` is parent/student-ownership-first with staff-only permission fallback; `viewAny` for parents is allowed but the controller now filters `whereIn('student_id', linkedStudentIds())`. Verified: parent list returns only own child's invoices; student list→403; parent fee summary→403.

### HIGH — Attendance: cross-record session view + any-class take
- **OWASP A01** · **ASVS V4.2.1, V4.1.3**
- **Location:** `app/Policies/AttendanceRecordPolicy.php:10-27`, `app/Http/Controllers/Api/V1/AttendanceController.php` (`session`, `take`)
- **Issue:** `attendance.view` (held by students/parents) passed `view` before the self/marked_by checks; `session()` authorized on the *first record only* and returned every record in the session. `take()` let any teacher record attendance for any class.
- **Fix:** `view` reordered (self → marked_by → staff-only permission); `session()` now filters records to the requester's linked students for student/parent roles (403 if none) or requires `attendance.view` for staff; `take()` requires a plain teacher to be assigned to the class via `class_subjects`. Verified: student view of others' records→403; teacher on non-assigned class→403.

### HIGH — Exam results directory accessible to students/parents
- **OWASP A01** · **ASVS V4.2.1**
- **Location:** `app/Policies/ExamSubjectPolicy.php:6-15`
- **Issue:** `exams.view` (held by students/parents) granted `view` on `exam-subjects/{id}`, returning every student's marks/grades for that subject.
- **Fix:** `view` now requires `isStaff()`; teacher_id short-circuit kept. Verified: parent→403; student's own result is served via the published dashboard endpoint instead.

### HIGH — Unguarded admin writes (academic structure, school settings)
- **OWASP A01** · **ASVS V4.1.1, V4.3.1**
- **Location:** `app/Http/Controllers/Api/V1/AcademicController.php` (`storeAcademicYear`, `setCurrentAcademicYear`, `storeTerm`, `updateTerm`), `app/Http/Controllers/Api/V1/SetupController.php` (`updateSchool`, `createAcademicYear`)
- **Issue:** No gate at all (or role-leaky) on academic-year/term creation and school profile mutation; any authenticated user could call them.
- **Fix:** `settings.manage` gate on academic-year/term writes; `school.update` on `updateSchool`; `settings.manage` on `createAcademicYear`. Verified: teacher/student→403, admin→200.

### HIGH — Dashboard fail-open to admin for unknown roles
- **OWASP A01** · **ASVS V4.1.1**
- **Location:** `app/Http/Controllers/Api/V1/DashboardController.php:20-26`
- **Issue:** `match` defaulted to `adminDashboard`, so a role-less or misconfigured user received the full admin dashboard (fees, payments, audit log).
- **Fix:** `default => abort(403)`. Verified: admin→200, student→200 (student dashboard), unknown role→403.

### HIGH — Report endpoints exposed to students/parents
- **OWASP A01** · **ASVS V4.1.3**
- **Location:** `app/Http/Controllers/Api/V1/ReportController.php` (`attendance`, `academic`, `finance`, `exportCsv`)
- **Issue:** `attendance` report gated only by `attendance.view` (students/parents hold it); CSV export had a single directory gate so staff without `payments.view`/`reports.view` could export financial/attendance data.
- **Fix:** All report methods require `isStaff()`; `exportCsv` adds per-type permission checks (`students`/`payments`/`attendance`). Verified: student reports/attendance→403, reports/students→403.

### HIGH — Assignment leak + cross-school writes + unvalidated file types
- **OWASP A01, A03** · **ASVS V4.2.1, V12.1-12.3, V5.1.3**
- **Location:** `app/Policies/AssignmentPolicy.php`, `app/Http/Controllers/Api/V1/AssignmentController.php` (`index`, `store`, `submit`)
- **Issue:** Parent saw all school assignments; student with no class saw all; `store` accepted cross-school `class_id`/`subject_id` (`exists` unscoped) and let any teacher create for any class; uploads accepted any file type.
- **Fix:** Parent index filtered to children's class ids; student with no class→403; `store` validates `class_id`/`subject_id` scoped to the tenant school and requires a plain teacher to be assigned to the class; attachments and submissions now enforce a `mimes:` whitelist (`pdf,doc,docx,xls,xlsx,ppt,pptx,jpg,jpeg,png,txt,zip`). Verified: teacher on unassigned class→403; admin bad-subject→422; `.exe` upload→422 for detectable types.

### HIGH — Assignment attachments lacked tenant isolation
- **OWASP A01** · **ASVS V4.3.2**
- **Location:** `app/Models/AssignmentAttachment.php`, migration `2026_08_09_011100_add_school_id_to_assignment_attachments.php`
- **Issue:** `assignment_attachments` had no `school_id`; the model lacked the `BelongsToSchool` global scope, so cross-tenant attachment download was possible in principle.
- **Fix:** Added `school_id` (backfilled, NOT NULL, FK cascade), applied `BelongsToSchool`, set `school_id` on create. Verified: school-1 teacher download→200, school-2 teacher→404.

### MEDIUM — Exam/timetable enumeration by students
- **OWASP A01** · **ASVS V4.2.1**
- **Location:** `app/Http/Controllers/Api/V1/ExamController.php:21`, `app/Http/Controllers/Api/V1/TimetableController.php:15`
- **Issue:** Students/parents could list exams and timetables for every class.
- **Fix:** Both index methods now scope to the requester's own class (student) / children's classes (parent). Verified: student timetables→only own class.

### MEDIUM — Email enumeration via forgot-password
- **OWASP A07** · **ASVS V2.5.1, V3.5.1**
- **Location:** `app/Http/Controllers/Api/V1/AuthController.php:151`
- **Issue:** Distinct success/failure messages revealed whether an email exists.
- **Fix:** Uniform response regardless of reset-link status; existing IP rate limit (3/10min) retained. Verified: unknown email returns the generic message.

### Fixed configuration hardening
- `RateLimiter` definitions confirmed (`login` 5/min/IP, `password` 3/10min/IP, `setup` 10/hour/IP, `api` 300 authed / 60 anon per minute). Verified live: 5 attempts then HTTP 429.

---

## Residual Findings (no code change this round)

### MEDIUM — `APP_DEBUG=true` leaks stack details on API errors
- **OWASP A05** · **ASVS V7.4.2, V7.3.1**
- **Location:** `bootstrap/app.php:54-61`, `.env`
- **Detail:** With debug on, `ThrottleRequestsException` (429) responses expose `exception`, `file`, `line`. Handler is correct (generic 500 + `report()` when debug off), but `.env` must set `APP_DEBUG=false` and `APP_ENV=production` for any non-local environment. Update `.env.example` accordingly.

### LOW — Unscoped `exists:` validators (cross-school FK at validation time)
- **OWASP A01** · **ASVS V5.1.3**
- **Location:** `StudentController.php:53`, `FeeController.php:97-100`, `AttendanceController.php:47,159`, `ReportController.php:53-54`, `AnnouncementController.php:53,83`
- **Detail:** Validation `exists:` queries bypass tenant scope, so a school-A request can reference school-B ids. The write paths are tenant-scoped (model global scope), so the impact is data-consistency rather than cross-tenant disclosure. Apply the `Rule::exists(...)->where('school_id', ...)` pattern (already applied in `AssignmentController::store` and `ExamController::store`) for consistency.

### LOW — `mimes:` content-sniff bypass for ambiguous files
- **OWASP A03** · **ASVS V12.1.3**
- **Location:** `AssignmentController.php` (`ALLOWED_MIME`), `submit`
- **Detail:** A 7-byte `MZ` file was sniffed as `text/plain` and accepted (Laravel `mimes` relies on content guessing). Mitigations already in place: uploads stored on the `private` disk with hashed filenames, served only via `Storage::download()` (forced `Content-Disposition: attachment`, no inline execution), 10–20 MB caps. Residual risk is negligible; optionally add an extension allow-list check on the original name as defense-in-depth.

### LOW — Suspended-account message enables login enumeration
- **OWASP A07** · **ASVS V2.5.1**
- **Location:** `app/Http/Controllers/Api/V1/AuthController.php:49-55`
- **Detail:** Suspended accounts return a distinct message ("account is suspended") versus invalid credentials. Return the same message for both to fully close enumeration.

---

## Positive Verifications (no findings)

- **Tenant isolation:** `BelongsToSchool` global scope on all tenant models; `SetSchoolContext` derives school server-side from the token; spatie team context via `SchoolTeamResolver`; `Gate::before` wildcard only for `super_admin`. Cross-school probes returned 404 (student record, attachment download, assignment access).
- **Dependencies:** `composer audit --locked` → 0 advisories; `npm audit` → 0 vulnerabilities.
- **Backup/restore:** `pg_dump -F c` → `pg_restore` round-trip to a scratch DB reproduced exact row counts (students=3, users=12, assignments=7, schools=2). Temp DB dropped.
- **Performance:** Hot queries use existing composite indexes (`students_school_id_class_id`, `student_fees_school_id_student_id_status`, `assignments_school_id_class_id`, `audit_logs_school_id_created_at`, `fee_payments_school_id_paid_at`); `EXPLAIN ANALYZE` sub-millisecond at demo scale; `ReportCardService` eager-loads results per student (no N+1).
- **Error handling:** API maps 401/403/404/422 to clean JSON; generic 500 + `report()` when debug is off.
- **Audit logging:** `AuditLogger::log` covers school/student/class/academic-year/term/subject/grade/exam/assignment/fee/payment/attendance-correction writes; surfaced on the admin dashboard.
- **Accessibility / mobile:** responsive sidebar with backdrop for mobile; responsive dashboard grids; `alt` text on images; `aria-label` and `role="status"` on toasts; semantic NavLinks.

---

## Suggested follow-ups
1. Set `APP_DEBUG=false` / `APP_ENV=production` outside local dev.
2. Unify the suspended-account login message.
3. Extend scoped `Rule::exists` to remaining controllers (list above).
4. Add `extension` allow-list check alongside `mimes:`.
5. Add automated feature tests for the policies changed here (repo currently has only the default `ExampleTest`).
