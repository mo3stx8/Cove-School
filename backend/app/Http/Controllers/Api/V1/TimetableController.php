<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\SchoolClass;
use App\Models\Timetable;
use App\Support\AuditLogger;
use App\Support\TenantContext;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class TimetableController extends Controller
{
    public function index(Request $request, ?SchoolClass $class = null)
    {
        Gate::authorize('viewAny', Timetable::class);

        $query = Timetable::query()->with(['class.grade', 'entries.subject', 'entries.teacher'])
            ->when($class, fn ($q) => $q->where('class_id', $class->id));

        return response()->json(['data' => $query->get()]);
    }

    public function store(Request $request)
    {
        Gate::authorize('manage', Timetable::class);

        $school = app(TenantContext::class)->school();

        $data = $request->validate([
            'academic_year_id' => ['required', 'exists:academic_years,id'],
            'term_id' => ['nullable', 'exists:terms,id'],
            'class_id' => ['required', 'exists:classes,id'],
            'name' => ['required', 'string', 'max:255'],
        ]);

        $timetable = $school->timetables()->create($data);
        AuditLogger::log('timetable.created', $timetable);

        return response()->json(['data' => $timetable], 201);
    }

    public function addEntry(Request $request, Timetable $timetable)
    {
        Gate::authorize('manage', Timetable::class);

        $data = $request->validate([
            'day_of_week' => ['required', 'integer', 'min:0', 'max:6'],
            'period_number' => ['required', 'integer', 'min:1', 'max:12'],
            'start_time' => ['required', 'date_format:H:i'],
            'end_time' => ['required', 'date_format:H:i', 'after:start_time'],
            'subject_id' => ['nullable', 'exists:subjects,id'],
            'teacher_id' => ['nullable', 'exists:users,id'],
            'room' => ['nullable', 'string', 'max:64'],
        ]);

        $conflict = $this->findTeacherConflict($timetable, $data);

        if ($conflict) {
            return response()->json([
                'message' => "Teacher conflict: already assigned to class {$conflict['class_name']} at period {$conflict['period_number']} on day {$conflict['day_of_week']}.",
            ], 422);
        }

        $entry = $timetable->entries()->create([
            'school_id' => $timetable->school_id,
            'day_of_week' => $data['day_of_week'],
            'period_number' => $data['period_number'],
            'start_time' => $data['start_time'],
            'end_time' => $data['end_time'],
            'subject_id' => $data['subject_id'] ?? null,
            'teacher_id' => $data['teacher_id'] ?? null,
            'room' => $data['room'] ?? null,
        ]);

        AuditLogger::log('timetable.entry_created', $entry);

        return response()->json(['data' => $entry], 201);
    }

    public function destroyEntry(Request $request, \App\Models\TimetableEntry $entry)
    {
        Gate::authorize('manage', Timetable::class);

        AuditLogger::log('timetable.entry_deleted', $entry);
        $entry->delete();

        return response()->json(['message' => 'Entry removed.']);
    }

    protected function findTeacherConflict(Timetable $timetable, array $data): ?array
    {
        if (empty($data['teacher_id'])) {
            return null;
        }

        return Timetable::query()
            ->where('school_id', $timetable->school_id)
            ->where('id', '!=', $timetable->id)
            ->whereHas('entries', function ($q) use ($data) {
                $q->where('day_of_week', $data['day_of_week'])
                    ->where('period_number', $data['period_number'])
                    ->where('teacher_id', $data['teacher_id']);
            })
            ->with('class')
            ->get()
            ->map(fn ($t) => [
                'class_name' => $t->class?->name,
                'day_of_week' => $data['day_of_week'],
                'period_number' => $data['period_number'],
            ])
            ->first();
    }
}
