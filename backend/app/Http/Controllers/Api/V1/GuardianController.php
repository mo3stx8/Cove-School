<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Guardian;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class GuardianController extends Controller
{
    /**
     * Instant check used by the student form: given the guardian's real
     * email (or system email), does an existing guardian profile/account
     * match? If yes the UI shows a "link" button instead of creating a
     * new account + invitation.
     */
    public function check(Request $request)
    {
        Gate::authorize('viewAny', Guardian::class);

        $data = $request->validate([
            'email' => ['nullable', 'string', 'max:255'],
            'system_email' => ['nullable', 'string', 'max:255'],
        ]);

        abort_if(empty($data['email']) && empty($data['system_email']), 422, 'Provide an email or system email.');

        $query = Guardian::query()
            ->with('user:id,name,system_email,email')
            ->withCount('students');

        if (! empty($data['email'])) {
            $query->where(function ($q) use ($data) {
                $q->where('email', $data['email'])
                    ->orWhere('system_email', $data['email'])
                    ->orWhereHas('user', fn ($u) => $u->where('system_email', $data['email'])->orWhere('email', $data['email']));
            });
        }

        if (! empty($data['system_email'])) {
            $query->where(function ($q) use ($data) {
                $q->where('system_email', $data['system_email'])
                    ->orWhere('email', $data['system_email'])
                    ->orWhereHas('user', fn ($u) => $u->where('system_email', $data['system_email']));
            });
        }

        $guardians = $query->get()->unique('user_id')->values();

        return response()->json([
            'exists' => $guardians->isNotEmpty(),
            'guardians' => $guardians->map(fn (Guardian $g) => [
                'id' => $g->id,
                'user_id' => $g->user_id,
                'name' => $g->displayName(),
                'relationship' => $g->relationship,
                'email' => $g->email,
                'system_email' => $g->system_email,
                'phone' => $g->phone,
                'linked_students_count' => $g->students_count,
            ]),
        ]);
    }
}
