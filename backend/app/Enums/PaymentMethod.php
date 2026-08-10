<?php

namespace App\Enums;

enum PaymentMethod: string
{
    case Cash = 'cash';
    case Card = 'card';
    case Bank = 'bank';
    case Online = 'online';

    public function label(): string
    {
        return ucfirst($this->value);
    }
}
