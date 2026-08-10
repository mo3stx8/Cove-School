<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Receipt {{ $payment->receipt_number }}</title>
    <style>
        body { font-family: DejaVu Sans, sans-serif; font-size: 13px; color: #1f2937; }
        .header { width: 100%; border-bottom: 3px solid #0f766e; padding-bottom: 16px; margin-bottom: 24px; }
        .school-name { font-size: 22px; font-weight: bold; color: #0f766e; }
        .receipt-title { font-size: 16px; font-weight: bold; margin-top: 4px; }
        .row { margin-bottom: 8px; }
        .label { display: inline-block; width: 180px; color: #6b7280; }
        .value { font-weight: bold; }
        .amount { font-size: 26px; color: #0f766e; font-weight: bold; text-align: center; margin: 24px 0; }
        .footer { margin-top: 48px; border-top: 1px solid #e5e7eb; padding-top: 12px; font-size: 11px; color: #9ca3af; }
    </style>
</head>
<body>
    <div class="header">
        <div class="school-name">{{ $school->name }}</div>
        <div class="receipt-title">Payment Receipt</div>
        <div>{{ $school->address }} @if($school->phone) &middot; {{ $school->phone }} @endif</div>
    </div>

    <div class="row"><span class="label">Receipt Number</span><span class="value">{{ $payment->receipt_number }}</span></div>
    <div class="row"><span class="label">Date</span><span class="value">{{ $payment->paid_at?->format('d M Y, H:i') }}</span></div>
    <div class="row"><span class="label">Student</span><span class="value">{{ $payment->student?->fullName() }}</span></div>
    <div class="row"><span class="label">Class</span><span class="value">{{ $payment->student?->class?->name }}</span></div>
    <div class="row"><span class="label">Fee</span><span class="value">{{ $payment->studentFee?->title }}</span></div>
    <div class="row"><span class="label">Payment Method</span><span class="value">{{ ucfirst($payment->payment_method->value) }}</span></div>
    @if($payment->paid_by_name)
    <div class="row"><span class="label">Paid By</span><span class="value">{{ $payment->paid_by_name }}</span></div>
    @endif

    <div class="amount">{{ $school->currency }} {{ number_format($payment->amount, 2) }}</div>

    <div class="footer">
        Received by {{ $payment->receivedBy?->name }} &middot; This is a system-generated receipt &middot; {{ $school->name }}
    </div>
</body>
</html>
