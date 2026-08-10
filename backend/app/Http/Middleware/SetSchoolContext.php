<?php

namespace App\Http\Middleware;

use App\Models\School;
use App\Support\TenantContext;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class SetSchoolContext
{
    public function __construct(private readonly TenantContext $tenant) {}

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user('sanctum') ?? Auth::user();

        if ($user?->school_id) {
            $this->tenant->setSchool(School::find($user->school_id));
        }

        return $next($request);
    }
}
