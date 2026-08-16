<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Guardian;
use App\Services\EmailUniquenessService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class EmailController extends Controller
{
    /**
     * Live check used by the student form: given a real email, who owns it?
     * Used to warn when an address is already taken by a student, teacher or
     * another parent.
     */
    public function check(Request $request, EmailUniquenessService $emails)
    {
        Gate::authorize('viewAny', Guardian::class);

        $data = $request->validate([
            'email' => ['required', 'string', 'max:255'],
        ]);

        $owner = $emails->ownerOf($data['email']);

        return response()->json([
            'email' => $data['email'],
            'used' => $owner !== null,
            'owners' => $owner ? [$owner] : [],
        ]);
    }
}
