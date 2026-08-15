<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\UserStatus;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\ActivationService;
use App\Support\AuditLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $credentials = $request->validate([
            'system_email' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'string', 'max:255'],
            'password' => ['required', 'string'],
            'remember' => ['sometimes', 'boolean'],
            'device_name' => ['sometimes', 'nullable', 'string'],
        ]);

        // "system_email" is the login ID. "email" is accepted as an alias
        // so existing clients keep working during the transition.
        $login = $credentials['system_email'] ?? $credentials['email'] ?? null;

        if ($login === null || $login === '') {
            throw ValidationException::withMessages([
                'system_email' => 'The system email field is required.',
            ]);
        }

        $key = 'login:'.$request->ip();

        if (RateLimiter::tooManyAttempts($key, 5)) {
            $seconds = RateLimiter::availableIn($key);

            throw ValidationException::withMessages([
                'system_email' => "Too many login attempts. Try again in {$seconds} seconds.",
            ]);
        }

        RateLimiter::hit($key, 60);

        if (! Auth::attempt(['system_email' => $login, 'password' => $credentials['password']], $credentials['remember'] ?? false)) {
            AuditLogger::log('auth.login_failed', null, null, ['system_email' => $login]);

            throw ValidationException::withMessages([
                'system_email' => 'The provided credentials are incorrect.',
            ]);
        }

        $user = Auth::user();

        if ($user->status !== UserStatus::Active) {
            Auth::logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            throw ValidationException::withMessages([
                'system_email' => 'Your account is suspended. Contact your administrator.',
            ]);
        }

        RateLimiter::clear($key);

        $request->session()->regenerate();

        $user->forceFill([
            'last_login_at' => now(),
            'last_login_ip' => $request->ip(),
        ])->save();

        AuditLogger::log('auth.login', $user);

        $token = null;

        if (! empty($credentials['device_name'])) {
            $token = $user->createToken($credentials['device_name'])->plainTextToken;
        }

        return response()->json([
            'user' => $user->load('school'),
            'token' => $token,
        ]);
    }

    /**
     * Activates an invited account using the link emailed to the user.
     *
     * Body: token (from the link) + email (the account's system email from the link).
     */
    public function activate(Request $request, ActivationService $activation)
    {
        $data = $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'string', 'max:255'],
            'password' => ['required', 'string', 'min:10', 'max:64', 'confirmed'],
        ]);

        $user = $activation->activate($data['email'], $data['token'], $data['password']);

        return response()->json([
            'message' => 'Account activated. You can now sign in.',
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'system_email' => $user->system_email,
            ],
        ]);
    }

    /**
     * Admin: re-issues the activation link for an account that never activated.
     */
    public function resendActivation(Request $request, ActivationService $activation)
    {
        abort_unless($request->user()->hasPermissionTo('users.update'), 403);

        $data = $request->validate([
            'system_email' => ['required', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
        ]);

        $user = User::query()
            ->where('system_email', $data['system_email'])
            ->where(function ($q) {
                $q->where('status', UserStatus::Invited)
                    ->orWhereNull('activated_at');
            })
            ->firstOrFail();

        $url = $activation->resend($user, $data['email'] ?? null);

        AuditLogger::log('auth.activation_resent', $user);

        return response()->json([
            'message' => 'Activation link resent.',
            'activation_url' => $url,
        ]);
    }

    public function logout(Request $request)
    {
        AuditLogger::log('auth.logout', $request->user());

        if ($request->user()->currentAccessToken()) {
            $request->user()->currentAccessToken()->delete();
        }

        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['message' => 'Logged out.']);
    }

    public function me(Request $request)
    {
        $user = $request->user()->load([
            'school',
            'roles',
            'permissions',
            'student' => fn ($q) => $q->with('class.grade'),
            'teacher',
        ]);

        return response()->json([
            'user' => $user,
            'permissions' => $user->getAllPermissions()->pluck('name'),
        ]);
    }

    public function updateProfile(Request $request)
    {
        $user = $request->user();

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:32'],
            'locale' => ['sometimes', 'string', 'in:en,ar'],
            'timezone' => ['sometimes', 'nullable', 'string', 'max:64'],
            'avatar' => ['sometimes', 'nullable', 'string', 'max:255'],
        ]);

        $user->update($data);

        return response()->json(['user' => $user]);
    }

    public function changePassword(Request $request)
    {
        $data = $request->validate([
            'current_password' => ['required', 'string'],
            'new_password' => ['required', 'string', 'min:10', 'max:64', 'confirmed'],
        ]);

        if (! Hash::check($data['current_password'], $request->user()->password)) {
            throw ValidationException::withMessages(['current_password' => 'Current password is incorrect.']);
        }

        $request->user()->update([
            'password' => $data['new_password'],
            'must_change_password' => false,
        ]);

        AuditLogger::log('auth.password_changed', $request->user());

        return response()->json(['message' => 'Password updated.']);
    }

    public function forgotPassword(Request $request)
    {
        $data = $request->validate(['email' => ['required', 'email']]);

        $key = 'forgot:'.$request->ip();

        if (RateLimiter::tooManyAttempts($key, 3)) {
            throw ValidationException::withMessages([
                'email' => 'Too many reset requests. Try again later.',
            ]);
        }

        RateLimiter::hit($key, 600);

        Password::sendResetLink($data);

        return response()->json([
            'message' => 'If an account exists for that email, a password reset link has been sent.',
        ]);
    }

    public function resetPassword(Request $request)
    {
        $data = $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'email'],
            'password' => ['required', 'string', 'min:10', 'max:64', 'confirmed'],
        ]);

        $status = Password::reset(
            $data,
            function ($user, $password) {
                $user->forceFill(['password' => Hash::make($password)])->save();
                AuditLogger::log('auth.password_reset', $user);
            }
        );

        if ($status !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages(['email' => __($status)]);
        }

        return response()->json(['message' => 'Password reset successfully.']);
    }

    public function verifyEmail(Request $request)
    {
        $request->user()->markEmailAsVerified();

        return response()->json(['message' => 'Email verified.']);
    }
}
