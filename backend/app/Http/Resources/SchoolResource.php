<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SchoolResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'logo' => $this->logo,
            'address' => $this->address,
            'city' => $this->city,
            'country' => $this->country,
            'phone' => $this->phone,
            'email' => $this->email,
            'website' => $this->website,
            'currency' => $this->currency,
            'timezone' => $this->timezone,
            'status' => $this->status->value,
            'subscription_plan' => $this->subscription_plan,
            'student_limit' => $this->student_limit,
            'teacher_limit' => $this->teacher_limit,
            'current_academic_year_id' => $this->current_academic_year_id,
        ];
    }
}
