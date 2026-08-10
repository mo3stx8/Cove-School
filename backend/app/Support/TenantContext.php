<?php

namespace App\Support;

use App\Models\School;

class TenantContext
{
    protected ?School $school = null;

    public function setSchool(?School $school): void
    {
        $this->school = $school;
    }

    public function school(): ?School
    {
        return $this->school;
    }

    public function schoolId(): ?int
    {
        return $this->school?->id;
    }
}
