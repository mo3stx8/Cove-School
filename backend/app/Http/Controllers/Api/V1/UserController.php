<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\UserStatus;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\ActivationService;
use App\Services\EmailUniquenessService;
use App\Support\AuditLogger;
use App\Support\TenantContext;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Spatie\Permission\PermissionRegistrar;

class UserController extends Controller
{
    public function index(Request $request)
    {
        Gate::authorize('viewAny', User::class);

        $school = app(TenantContext::class)->school();

        $query = User::query()
            ->with('roles')
            ->where('school_id', $school->id)
            ->when($request->input('search'), function ($q, $search) {
                $q->where(function ($w) use ($search) {
                    $w->where('name', 'ilike', "%{$search}%")
                        ->orWhere('system_email', 'ilike', "%{$search}%")
                        ->orWhere('email', 'ilike', "%{$search}%");
                });
            })
            ->when($request->input('role'), function ($q, $role) {
                $q->role($role);
            })
            ->when($request->input('status'), fn ($q, $s) => $q->where('status', $s));

        $users = $query->latest()->paginate($request->integer('per_page', 25));

        return response()->json(['data' => $users]);
    }

    public function store(Request $request, ActivationService $activation, EmailUniquenessService $emailCheck)
    {
        Gate::authorize('create', User::class);

        $school = app(TenantContext::class)->school();

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'system_email' => ['required', 'email', 'max:255', Rule::unique('users', 'system_email')],
            'email' => ['required', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:32'],
            'role' => ['required', Rule::in(['admin', 'teacher', 'accountant'])],
        ]);

        $emailCheck->assertUnique(['email' => $data['email']]);

        $user = DB::transaction(function () use ($data, $school, $activation) {
            $user = User::create([
                'school_id' => $school->id,
                'name' => $data['name'],
                'system_email' => $data['system_email'],
                'email' => $data['email'],
                'phone' => $data['phone'] ?? null,
                'password' => 'pending',
                'locale' => 'en',
                'timezone' => $school->timezone,
                'status' => UserStatus::Invited,
            ]);

            $registrar = app(PermissionRegistrar::class);
            $registrar->setPermissionsTeamId($school->id);
            $user->assignRole($data['role']);

            $activation->invite($user, $data['email']);

            AuditLogger::log('user.created', $user, null, $user->toArray());

            return $user;
        });

        return response()->json(['data' => $user->load('roles')], 201);
    }

    public function show(Request $request, User $user)
    {
        Gate::authorize('view', $user);

        $user->load('roles');

        return response()->json(['data' => $user]);
    }

    public function update(Request $request, User $user)
    {
        Gate::authorize('update', $user);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'system_email' => ['sometimes', 'email', 'max:255', Rule::unique('users', 'system_email')->ignore($user->id)],
            'email' => ['sometimes', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:32'],
            'role' => ['sometimes', Rule::in(['admin', 'teacher', 'accountant'])],
        ]);

        if (isset($data['email']) && $data['email'] !== $user->email) {
            app(EmailUniquenessService::class)->assertUnique(['email' => $data['email']], [$user->id]);
        }

        $user->update(collect($data)->except('role')->toArray());

        if (isset($data['role']) && $data['role'] !== $user->getRoleNames()->first()) {
            $registrar = app(PermissionRegistrar::class);
            $registrar->setPermissionsTeamId($user->school_id);
            $user->syncRoles([$data['role']]);
        }

        AuditLogger::log('user.updated', $user);

        return response()->json(['data' => $user->load('roles')]);
    }

    public function archive(Request $request, User $user)
    {
        Gate::authorize('update', $user);

        abort_if($user->hasRole('super_admin'), 403, 'Cannot archive the super admin.');

        $user->update(['status' => UserStatus::Suspended]);
        AuditLogger::log('user.archived', $user);

        return response()->json(['data' => $user->load('roles')]);
    }

    public function restore(Request $request, User $user)
    {
        Gate::authorize('update', $user);

        $user->update(['status' => UserStatus::Active]);
        AuditLogger::log('user.restored', $user);

        return response()->json(['data' => $user->load('roles')]);
    }

    public function resendActivation(Request $request, User $user, ActivationService $activation)
    {
        Gate::authorize('update', $user);

        abort_unless($user->status === UserStatus::Invited || is_null($user->activated_at), 400, 'User is already activated.');

        $url = $activation->resend($user, $user->email);

        AuditLogger::log('user.activation_resent', $user);

        return response()->json([
            'message' => 'Activation link resent.',
            'activation_url' => $url,
        ]);
    }
}
