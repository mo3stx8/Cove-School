<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class StudentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'student_number' => $this->student_number,
            'admission_number' => $this->admission_number,
            'first_name' => $this->first_name,
            'middle_name' => $this->middle_name,
            'last_name' => $this->last_name,
            'full_name' => $this->fullName(),
            'date_of_birth' => $this->date_of_birth?->toDateString(),
            'gender' => $this->gender,
            'nationality' => $this->nationality,
            'photo' => $this->photo,
            'status' => $this->status->value,
            'enrollment_date' => $this->enrollment_date?->toDateString(),
            'emergency_contact_name' => $this->emergency_contact_name,
            'emergency_contact_relationship' => $this->emergency_contact_relationship,
            'emergency_contact_phone' => $this->emergency_contact_phone,
            'class_id' => $this->class_id,
            'class' => $this->whenLoaded('class', fn () => [
                'id' => $this->class->id,
                'name' => $this->class->name,
            ]),
            'user_id' => $this->user_id,
            'user' => $this->whenLoaded('user', fn () => [
                'id' => $this->user->id,
                'name' => $this->user->name,
                'system_email' => $this->user->system_email,
                'email' => $this->user->email,
                'phone' => $this->user->phone,
            ]),
            'guardians' => $this->whenLoaded('guardians', fn () => $this->guardians->map(fn ($g) => [
                'id' => $g->id,
                'name' => $g->displayName(),
                'phone' => $g->phone,
                'email' => $g->email,
                'system_email' => $g->system_email,
                'relationship' => $g->pivot->relationship,
                'is_primary' => (bool) $g->pivot->is_primary,
            ])),
            'attendance_rate' => $this->whenAppended('attendance_rate'),
            'created_at' => $this->created_at?->toISOString(),
        ];
    }
}
