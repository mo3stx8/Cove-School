<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Announcement;
use App\Support\AuditLogger;
use App\Support\TenantContext;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class AnnouncementController extends Controller
{
    public function index(Request $request)
    {
        Gate::authorize('viewAny', Announcement::class);

        $user = $request->user();

        $query = Announcement::query()
            ->with('author')
            ->when($request->input('status'), fn ($q, $s) => $q->where('status', $s))
            ->when($request->input('audience'), fn ($q, $a) => $q->where('audience', $a));

        if ($user->hasRole('student')) {
            $classId = $user->student?->class_id;
            $query->where(fn ($q) => $q->where('audience', 'everyone')
                ->orWhere('audience', 'students')
                ->when($classId, fn ($w) => $w->orWhere(fn ($c) => $c->where('audience', 'class')->where('class_id', $classId))));
        }

        if ($user->hasRole('parent')) {
            $query->whereIn('audience', ['everyone', 'parents']);
        }

        if ($user->hasRole('teacher')) {
            $query->whereIn('audience', ['everyone', 'teachers']);
        }

        return response()->json(['data' => $query->latest('published_at')->paginate($request->integer('per_page', 25))]);
    }

    public function store(Request $request)
    {
        Gate::authorize('create', Announcement::class);

        $school = app(TenantContext::class)->school();

        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'body' => ['required', 'string'],
            'audience' => ['required', 'in:everyone,teachers,students,parents,class'],
            'class_id' => ['nullable', 'required_if:audience,class', 'exists:classes,id'],
            'expires_at' => ['nullable', 'date', 'after:today'],
        ]);

        $announcement = $school->announcements()->create([
            'created_by' => $request->user()->id,
            'title' => $data['title'],
            'body' => $data['body'],
            'audience' => $data['audience'],
            'class_id' => $data['class_id'] ?? null,
            'status' => 'published',
            'published_at' => now(),
            'expires_at' => $data['expires_at'] ?? null,
        ]);

        AuditLogger::log('announcement.created', $announcement);

        \App\Services\NotificationService::announcementCreated($announcement, $school);

        return response()->json(['data' => $announcement], 201);
    }

    public function update(Request $request, Announcement $announcement)
    {
        Gate::authorize('create', Announcement::class);

        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:255'],
            'body' => ['sometimes', 'string'],
            'audience' => ['sometimes', 'in:everyone,teachers,students,parents,class'],
            'class_id' => ['nullable', 'required_if:audience,class', 'exists:classes,id'],
            'expires_at' => ['nullable', 'date'],
        ]);

        if (array_key_exists('audience', $data) && $data['audience'] !== 'class') {
            $data['class_id'] = null;
        }

        $announcement->update($data);
        AuditLogger::log('announcement.updated', $announcement);

        return response()->json(['data' => $announcement]);
    }

    public function destroy(Request $request, Announcement $announcement)
    {
        Gate::authorize('create', Announcement::class);

        $announcement->update(['status' => 'archived']);
        AuditLogger::log('announcement.archived', $announcement);

        return response()->json(['message' => 'Announcement archived.']);
    }
}
