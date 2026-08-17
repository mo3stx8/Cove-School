<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\TeacherResource;
use App\Models\Teacher;
use App\Services\EmailUniquenessService;
use App\Services\TeacherService;
use App\Support\AuditLogger;
use App\Support\TenantContext;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class TeacherController extends Controller
{
    public function __construct(private readonly TeacherService $teachers) {}

    public function index(Request $request)
    {
        Gate::authorize('viewAny', Teacher::class);

        $query = Teacher::query()
            ->with('user')
            ->when($request->input('status'), fn ($q, $s) => $q->where('status', $s))
            ->when($request->input('search'), function ($q, $search) {
                $q->whereHas('user', fn ($u) => $u
                    ->where('name', 'ilike', "%{$search}%")
                    ->orWhere('name_ar', 'ilike', "%{$search}%")
                    ->orWhere('system_email', 'ilike', "%{$search}%")
                    ->orWhere('email', 'ilike', "%{$search}%"));
            });

        return TeacherResource::collection($query->latest()->paginate($request->integer('per_page', 25)));
    }

    public function store(Request $request)
    {
        Gate::authorize('create', Teacher::class);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'name_ar' => ['nullable', 'string', 'max:255'],
            'system_email' => ['required', 'string', 'max:255', 'unique:users,system_email'],
            'email' => ['required', 'email', 'max:255'],
            'phone' => ['required', 'string', 'max:32', 'regex:/^[0-9+\s\-()]+$/'],
            'specialization' => ['required', 'string', 'max:255'],
            'qualification' => ['required', 'string', 'max:255'],
            'gender' => ['required', 'in:male,female'],
            'joining_date' => ['required', 'date'],
            'address' => ['required', 'string'],
            'employee_id' => ['nullable', 'string', 'max:64'],
        ]);

        app(EmailUniquenessService::class)->assertUnique(['email' => $data['email']]);

        $teacher = $this->teachers->create($data, app(TenantContext::class)->school(), $request->user());

        return new TeacherResource($teacher->load('user'));
    }

    public function show(Request $request, Teacher $teacher)
    {
        Gate::authorize('view', $teacher);

        $teacher->load(['user', 'classSubjects.class', 'classSubjects.subject']);

        return new TeacherResource($teacher);
    }

    public function update(Request $request, Teacher $teacher)
    {
        Gate::authorize('update', $teacher);

        $data = $request->validate([
            'employee_id' => ['sometimes', 'string', 'max:64'],
            'qualification' => ['sometimes', 'string', 'max:255'],
            'specialization' => ['sometimes', 'string', 'max:255'],
            'joining_date' => ['sometimes', 'date'],
            'address' => ['sometimes', 'string'],
            'name' => ['sometimes', 'string', 'max:255'],
            'name_ar' => ['sometimes', 'string', 'max:255'],
            'gender' => ['sometimes', 'in:male,female'],
            'phone' => ['sometimes', 'string', 'max:32', 'regex:/^[0-9+\s\-()]+$/'],
            'system_email' => ['sometimes', 'string', 'max:255', Rule::unique('users', 'system_email')->ignore($teacher->user_id, 'id')],
            'email' => ['sometimes', 'email', 'max:255'],
        ]);

        if (! empty($data['email'])) {
            app(EmailUniquenessService::class)->assertUnique(
                ['email' => $data['email']],
                exceptUserIds: [$teacher->user_id],
            );
        }

        $teacher->update($data);

        if ($teacher->user) {
            if (($data['name'] ?? null)) {
                $teacher->user->update(['name' => $data['name']]);
            }

            if (array_key_exists('name_ar', $data)) {
                $teacher->user->update(['name_ar' => $data['name_ar']]);
            }

            if (array_key_exists('gender', $data)) {
                $teacher->user->update(['gender' => $data['gender']]);
            }

            if (array_key_exists('system_email', $data)) {
                $teacher->user->update(['system_email' => $data['system_email']]);
            }

            if (array_key_exists('email', $data)) {
                $teacher->user->update(['email' => $data['email']]);
            }
        }

        AuditLogger::log('teacher.updated', $teacher);

        return new TeacherResource($teacher->load('user'));
    }

    public function archive(Request $request, Teacher $teacher)
    {
        Gate::authorize('archive', $teacher);

        $data = $request->validate(['reason' => ['nullable', 'string', 'max:1000']]);

        $this->teachers->archive($teacher, $data['reason'] ?? null);

        return response()->json(['message' => 'Teacher archived.']);
    }

    public function restore(Request $request, Teacher $teacher)
    {
        Gate::authorize('update', $teacher);

        $teacher->update(['status' => 'active', 'leaving_date' => null]);
        AuditLogger::log('teacher.restored', $teacher);

        return new TeacherResource($teacher->load('user'));
    }
}
