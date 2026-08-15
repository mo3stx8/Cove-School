<?php

namespace App\Services;

use App\Enums\UserStatus;
use App\Mail\AccountActivation;
use App\Models\User;
use App\Support\AuditLogger;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Account activation flow (no default/random passwords).
 *
 * Create Account
 *   -> Generate Activation Token
 *   -> Send Activation Link
 *   -> User Sets Password
 *   -> Password Hash
 *   -> Database
 *
 * The token is stored hashed (bcrypt). Activation is resolved by the
 * account's system email + the plaintext token from the link, so the
 * lookup stays O(1) without keeping raw secrets in the database.
 */
class ActivationService
{
    public const TOKEN_TTL_HOURS = 48;

    /**
     * Marks a user as invited and mails a single-use activation link.
     *
     * Returns the plaintext activation URL (used for logging/debugging).
     */
    public function invite(User $user, ?string $realEmail = null): string
    {
        $token = Str::random(64);

        $user->forceFill([
            'email' => $realEmail ?? $user->email,
            'status' => UserStatus::Invited,
            'password' => Str::random(32),
            'activation_token' => Hash::make($token),
            'activation_token_expires_at' => now()->addHours(self::TOKEN_TTL_HOURS),
            'activated_at' => null,
            'must_change_password' => false,
        ])->save();

        $url = $this->activationUrl($user, $token);

        if ($user->email) {
            Mail::to($user->email)->send(new AccountActivation($url, $user->system_email, $user->name));
        }

        return $url;
    }

    /**
     * Validates the activation link and sets the user-chosen password.
     */
    public function activate(string $systemEmail, string $token, string $password): User
    {
        $user = User::query()
            ->where('system_email', $systemEmail)
            ->whereNotNull('activation_token')
            ->first();

        if (! $user || ! Hash::check($token, $user->activation_token)) {
            throw ValidationException::withMessages([
                'token' => 'This activation link is invalid.',
            ]);
        }

        if ($user->activation_token_expires_at === null || $user->activation_token_expires_at->isPast()) {
            throw ValidationException::withMessages([
                'token' => 'This activation link has expired. Ask the school to resend it.',
            ]);
        }

        $user->forceFill([
            'password' => $password,
            'status' => UserStatus::Active,
            'activation_token' => null,
            'activation_token_expires_at' => null,
            'activated_at' => now(),
            'must_change_password' => false,
        ])->save();

        AuditLogger::log('auth.account_activated', $user);

        return $user;
    }

    /**
     * Re-issues an activation token for a user who never completed activation.
     */
    public function resend(User $user, ?string $realEmail = null): string
    {
        return $this->invite($user, $realEmail);
    }

    protected function activationUrl(User $user, string $token): string
    {
        return rtrim((string) config('app.frontend_url'), '/')
            .'/activate?token='.$token
            .'&email='.urlencode((string) $user->system_email);
    }
}
