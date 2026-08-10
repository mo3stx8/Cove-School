<?php

namespace App\Services;

use App\Enums\FeeStatus;
use App\Enums\PaymentMethod;
use App\Models\FeePayment;
use App\Models\School;
use App\Models\StudentFee;
use App\Models\User;
use App\Support\AuditLogger;
use App\Support\NumberGenerator;
use App\Support\TenantContext;
use Illuminate\Support\Facades\DB;

class PaymentService
{
    public function recordPayment(StudentFee $studentFee, float $amount, PaymentMethod $method, User $receivedBy, ?string $notes = null): FeePayment
    {
        return DB::transaction(function () use ($studentFee, $amount, $method, $receivedBy, $notes) {
            $school = app(TenantContext::class)->school();

            if ($amount <= 0) {
                throw new \InvalidArgumentException('Payment amount must be greater than zero.');
            }

            $outstanding = $studentFee->outstandingAmount();

            if ($amount > $outstanding) {
                throw new \InvalidArgumentException('Payment exceeds the outstanding balance.');
            }

            $payment = FeePayment::create([
                'school_id' => $school->id,
                'student_fee_id' => $studentFee->id,
                'student_id' => $studentFee->student_id,
                'amount' => $amount,
                'payment_method' => $method,
                'notes' => $notes,
                'receipt_number' => NumberGenerator::receiptNumber($school->id),
                'received_by' => $receivedBy->id,
                'paid_at' => now(),
            ]);

            $paid = $studentFee->paidAmount();
            $net = $studentFee->netAmount();

            $studentFee->update([
                'status' => $paid >= $net ? FeeStatus::Paid : ($paid > 0 ? FeeStatus::Partial : FeeStatus::Unpaid),
            ]);

            AuditLogger::log('payment.recorded', $payment, null, $payment->toArray());

            return $payment;
        });
    }
}
