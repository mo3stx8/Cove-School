<?php

namespace App\Enums;

enum GradeStatus: string
{
    case Draft = 'draft';
    case Submitted = 'submitted';
    case Reviewed = 'reviewed';
    case Published = 'published';

    public function label(): string
    {
        return ucfirst($this->value);
    }
}
