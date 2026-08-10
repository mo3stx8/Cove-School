<?php

namespace App\Enums;

enum StudentStatus: string
{
    case Active = 'active';
    case Inactive = 'inactive';
    case Archived = 'archived';
    case Graduated = 'graduated';
    case Transferred = 'transferred';

    public function label(): string
    {
        return ucfirst($this->value);
    }
}
