<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\StudentStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\StudentResource;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Services\StudentService;
use App\Support\AuditLogger;
use App\Support\TenantContext;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class StudentController extends Controller
{
    public function __construct(private readonly StudentService $students) {}

    public function index(Request $request)
    {
        Gate::authorize('viewAny', Student::class);

        $query = Student::query()
            ->with(['class.grade', 'user'])
            ->when($request->input('class_id'), fn ($q, $id) => $q->where('class_id', $id))
            ->when($request->input('grade_id'), fn ($q, $id) => $q->whereHas('class', fn ($c) => $c->where('grade_id', $id)))
            ->when($request->input('status'), fn ($q, $s) => $q->where('status', $s))
            ->when($request->input('search'), function ($q, $search) {
                $q->where(function ($w) use ($search) {
                    $w->where('first_name', 'ilike', "%{$search}%")
                        ->orWhere('last_name', 'ilike', "%{$search}%")
                        ->orWhere('student_number', 'ilike', "%{$search}%");
                });
            });

        return StudentResource::collection($query->latest()->paginate($request->integer('per_page', 25)));
    }

    public function store(Request $request)
    {
        Gate::authorize('create', Student::class);

        $data = $request->validate([
            'first_name' => ['required', 'string', 'max:255'],
            'middle_name' => ['nullable', 'string', 'max:255'],
            'last_name' => ['required', 'string', 'max:255'],
            'system_email' => ['nullable', 'string', 'max:255', Rule::unique('users', 'system_email')],
            'email' => ['nullable', 'email', 'max:255'],
            'date_of_birth' => ['nullable', 'date', 'before:today'],
            'gender' => ['nullable', 'in:male,female'],
            'nationality' => ['nullable', 'string', 'max:100'],
            'address' => ['nullable', 'string'],
            'enrollment_date' => ['nullable', 'date'],
            'class_id' => ['nullable', 'exists:classes,id'],
            'emergency_contact_name' => ['nullable', 'string', 'max:255'],
            'emergency_contact_relationship' => ['nullable', 'string', 'max:64'],
            'emergency_contact_phone' => ['nullable', 'string', 'max:32'],
            'medical_notes' => ['nullable', 'string'],
            'father' => ['nullable', 'array'],
            'father.name' => ['nullable', 'string', 'max:255'],
            'father.phone' => ['nullable', 'string', 'max:32'],
            'father.email' => ['nullable', 'email', 'max:255'],
            'father.system_email' => ['nullable', 'string', 'max:255'],
            'father.address' => ['nullable', 'string'],
            'father.occupation' => ['nullable', 'string', 'max:255'],
            'father.linked_guardian_id' => ['nullable', 'integer'],
            'mother' => ['nullable', 'array'],
            'mother.name' => ['nullable', 'string', 'max:255'],
            'mother.phone' => ['nullable', 'string', 'max:32'],
            'mother.email' => ['nullable', 'email', 'max:255'],
            'mother.system_email' => ['nullable', 'string', 'max:255'],
            'mother.address' => ['nullable', 'string'],
            'mother.occupation' => ['nullable', 'string', 'max:255'],
            'mother.linked_guardian_id' => ['nullable', 'integer'],
            'guardian' => ['nullable', 'array'],
            'guardian.guardian_name' => ['nullable', 'string', 'max:255'],
            'guardian.father_name' => ['nullable', 'string', 'max:255'],
            'guardian.mother_name' => ['nullable', 'string', 'max:255'],
            'guardian.email' => ['nullable', 'email', 'max:255'],
            'guardian.phone' => ['nullable', 'string', 'max:32'],
            'guardian.relationship' => ['nullable', 'string', 'max:64'],
            'guardian.address' => ['nullable', 'string'],
        ]);

        $student = $this->students->enroll($data, app(TenantContext::class)->school(), $request->user());

        return new StudentResource($student->load('class.grade', 'user', 'guardians'));
    }

    public function show(Request $request, Student $student)
    {
        Gate::authorize('view', $student);

        $student->load(['class.grade', 'user', 'guardians', 'documents']);

        if ($request->boolean('with_stats')) {
            $student->append('attendance_rate');
        }

        return new StudentResource($student);
    }

    public function update(Request $request, Student $student)
    {
        Gate::authorize('update', $student);

        $data = $request->validate([
            'first_name' => ['sometimes', 'string', 'max:255'],
            'middle_name' => ['nullable', 'string', 'max:255'],
            'last_name' => ['sometimes', 'string', 'max:255'],
            'system_email' => ['nullable', 'string', 'max:255', Rule::unique('users', 'system_email')->ignore($student->user_id, 'id')],
            'email' => ['nullable', 'email', 'max:255'],
            'date_of_birth' => ['nullable', 'date', 'before:today'],
            'gender' => ['nullable', 'in:male,female'],
            'nationality' => ['nullable', 'string', 'max:100'],
            'photo' => ['nullable', 'string', 'max:255'],
            'address' => ['nullable', 'string'],
            'class_id' => ['nullable', 'exists:classes,id'],
            'emergency_contact_name' => ['nullable', 'string', 'max:255'],
            'emergency_contact_relationship' => ['nullable', 'string', 'max:64'],
            'emergency_contact_phone' => ['nullable', 'string', 'max:32'],
            'medical_notes' => ['nullable', 'string'],
        ]);

        $old = $student->toArray();
        $student->update($data);

        if ($student->user) {
            if (array_key_exists('system_email', $data)) {
                $student->user->update(['system_email' => $data['system_email']]);
            }

            if (array_key_exists('email', $data)) {
                $student->user->update(['email' => $data['email']]);
            }
        }

        AuditLogger::log('student.updated', $student, $old, $student->toArray());

        return new StudentResource($student->load('class.grade', 'user', 'guardians'));
    }

    public function archive(Request $request, Student $student)
    {
        Gate::authorize('archive', $student);

        $data = $request->validate(['reason' => ['nullable', 'string', 'max:1000']]);

        $this->students->archive($student, $data['reason'] ?? null);

        return response()->json(['message' => 'Student archived.', 'student' => new StudentResource($student)]);
    }

    public function restore(Request $request, Student $student)
    {
        Gate::authorize('update', $student);

        $student->update(['status' => StudentStatus::Active]);
        AuditLogger::log('student.restored', $student);

        return new StudentResource($student);
    }

    public function assignClass(Request $request, Student $student)
    {
        Gate::authorize('update', $student);

        $data = $request->validate(['class_id' => ['required', 'exists:classes,id']]);

        $class = SchoolClass::findOrFail($data['class_id']);

        $old = $student->only(['class_id']);
        $student->update(['class_id' => $class->id]);

        AuditLogger::log('student.class_assigned', $student, $old, ['class_id' => $class->id]);

        return new StudentResource($student->load('class.grade'));
    }
}
