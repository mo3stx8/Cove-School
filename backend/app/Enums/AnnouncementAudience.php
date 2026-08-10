<?php

namespace App\Enums;

enum AnnouncementAudience: string
{
    case Everyone = 'everyone';
    case Teachers = 'teachers';
    case Students = 'students';
    case Parents = 'parents';
    case SpecificClass = 'class';

    public function label(): string
    {
        return ucfirst($this->value);
    }
}
