<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TeacherResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'employee_id' => $this->employee_id,
            'qualification' => $this->qualification,
            'joining_date' => $this->joining_date?->toDateString(),
            'status' => $this->status,
            'user_id' => $this->user_id,
            'user' => $this->whenLoaded('user', fn () => [
                'id' => $this->user->id,
                'name' => $this->user->name,
                'email' => $this->user->email,
                'phone' => $this->user->phone,
                'avatar' => $this->user->avatar,
            ]),
            'subjects' => $this->whenLoaded('classSubjects', fn () => $this->classSubjects->map(fn ($cs) => [
                'class_id' => $cs->class_id,
                'class_name' => $cs->class->name ?? null,
                'subject_id' => $cs->subject_id,
                'subject_name' => $cs->subject->name ?? null,
            ])),
        ];
    }
}
