<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\TeacherResource;
use App\Models\Teacher;
use App\Services\TeacherService;
use App\Support\TenantContext;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

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
                $q->whereHas('user', fn ($u) => $u->where('name', 'ilike', "%{$search}%")->orWhere('email', 'ilike', "%{$search}%"));
            });

        return TeacherResource::collection($query->latest()->paginate($request->integer('per_page', 25)));
    }

    public function store(Request $request)
    {
        Gate::authorize('create', Teacher::class);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'phone' => ['nullable', 'string', 'max:32'],
            'employee_id' => ['nullable', 'string', 'max:64'],
            'qualification' => ['nullable', 'string', 'max:255'],
            'joining_date' => ['nullable', 'date'],
            'address' => ['nullable', 'string'],
        ]);

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
            'qualification' => ['nullable', 'string', 'max:255'],
            'joining_date' => ['nullable', 'date'],
            'address' => ['nullable', 'string'],
            'name' => ['sometimes', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:32'],
        ]);

        $teacher->update($data);

        if (($data['name'] ?? null) && $teacher->user) {
            $teacher->user->update(['name' => $data['name']]);
        }

        \App\Support\AuditLogger::log('teacher.updated', $teacher);

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
        \App\Support\AuditLogger::log('teacher.restored', $teacher);

        return new TeacherResource($teacher->load('user'));
    }
}
