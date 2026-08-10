<?php

namespace App\Models;

use App\Enums\FeeStatus;
use App\Support\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class StudentFee extends Model
{
    use BelongsToSchool;

    protected $fillable = [
        'school_id', 'student_id', 'fee_type_id', 'academic_year_id', 'term_id',
        'invoice_number', 'title', 'amount', 'discount_amount', 'discount_reason',
        'due_date', 'status',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'float',
            'discount_amount' => 'float',
            'due_date' => 'date',
            'status' => FeeStatus::class,
        ];
    }

    public function school(): BelongsTo
    {
        return $this->belongsTo(School::class);
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    public function feeType(): BelongsTo
    {
        return $this->belongsTo(FeeType::class);
    }

    public function term(): BelongsTo
    {
        return $this->belongsTo(Term::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(FeePayment::class);
    }

    public function netAmount(): float
    {
        return round($this->amount - $this->discount_amount, 2);
    }

    public function paidAmount(): float
    {
        return round($this->payments()->sum('amount'), 2);
    }

    public function outstandingAmount(): float
    {
        return round(max(0, $this->netAmount() - $this->paidAmount()), 2);
    }
}
