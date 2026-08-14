<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\PaymentMethod;
use App\Http\Controllers\Controller;
use App\Models\FeePayment;
use App\Models\FeeType;
use App\Models\Student;
use App\Models\StudentFee;
use App\Services\PaymentService;
use App\Support\AuditLogger;
use App\Support\NumberGenerator;
use App\Support\TenantContext;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class FeeController extends Controller
{
    public function __construct(private readonly PaymentService $payments) {}

    // ---- Fee types ----

    public function feeTypes()
    {
        Gate::authorize('view', FeeType::class);

        return response()->json(['data' => FeeType::query()->orderBy('name')->get()]);
    }

    public function storeFeeType(Request $request)
    {
        Gate::authorize('create', FeeType::class);

        $school = app(TenantContext::class)->school();

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'code' => ['nullable', 'string', 'max:32'],
            'amount' => ['required', 'numeric', 'min:0'],
            'frequency' => ['sometimes', 'in:term,year,one-time'],
            'description' => ['nullable', 'string'],
        ]);

        $feeType = $school->feeTypes()->create($data);
        AuditLogger::log('fee_type.created', $feeType);

        return response()->json(['data' => $feeType], 201);
    }

    public function updateFeeType(Request $request, FeeType $feeType)
    {
        Gate::authorize('update', FeeType::class);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'amount' => ['sometimes', 'numeric', 'min:0'],
            'frequency' => ['sometimes', 'in:term,year,one-time'],
            'description' => ['nullable', 'string'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $feeType->update($data);
        AuditLogger::log('fee_type.updated', $feeType);

        return response()->json(['data' => $feeType]);
    }

    // ---- Student fees (invoices) ----

    public function invoices(Request $request)
    {
        Gate::authorize('viewAny', StudentFee::class);

        $user = $request->user();

        $query = StudentFee::query()
            ->with(['student', 'feeType', 'term'])
            ->when($user->hasRole('parent'), fn ($q) => $q->whereIn('student_id', $user->linkedStudentIds() ?: [0]))
            ->when($request->input('student_id'), fn ($q, $id) => $q->where('student_id', $id))
            ->when($request->input('status'), fn ($q, $s) => $q->where('status', $s))
            ->when($request->input('class_id'), fn ($q, $id) => $q->whereHas('student', fn ($s) => $s->where('class_id', $id)));

        $invoices = $query->latest()->paginate($request->integer('per_page', 25));

        return response()->json(['data' => $invoices]);
    }

    public function storeInvoice(Request $request)
    {
        Gate::authorize('create', StudentFee::class);

        $school = app(TenantContext::class)->school();

        $data = $request->validate([
            'student_id' => ['required', 'exists:students,id'],
            'fee_type_id' => ['nullable', 'exists:fee_types,id'],
            'academic_year_id' => ['nullable', 'exists:academic_years,id'],
            'term_id' => ['nullable', 'exists:terms,id'],
            'title' => ['required', 'string', 'max:255'],
            'amount' => ['required', 'numeric', 'min:0'],
            'discount_amount' => ['sometimes', 'numeric', 'min:0'],
            'discount_reason' => ['nullable', 'string', 'max:500'],
            'due_date' => ['nullable', 'date'],
        ]);

        $invoice = $school->studentFees()->create([
            'student_id' => $data['student_id'],
            'fee_type_id' => $data['fee_type_id'] ?? null,
            'academic_year_id' => $data['academic_year_id'] ?? $school->current_academic_year_id,
            'term_id' => $data['term_id'] ?? null,
            'invoice_number' => NumberGenerator::invoiceNumber($school->id),
            'title' => $data['title'],
            'amount' => $data['amount'],
            'discount_amount' => $data['discount_amount'] ?? 0,
            'discount_reason' => $data['discount_reason'] ?? null,
            'due_date' => $data['due_date'] ?? null,
            'status' => 'unpaid',
        ]);

        AuditLogger::log('invoice.created', $invoice, null, $data);

        return response()->json(['data' => $invoice->load('student', 'feeType', 'term')], 201);
    }

    public function invoice(Request $request, StudentFee $studentFee)
    {
        Gate::authorize('view', $studentFee);

        $studentFee->load(['student.class.grade', 'feeType', 'term', 'payments.receivedBy']);

        return response()->json(['data' => $studentFee]);
    }

    // ---- Payments ----

    public function payments(Request $request)
    {
        Gate::authorize('viewAny', FeePayment::class);

        $query = FeePayment::query()
            ->with(['student', 'studentFee'])
            ->when($request->input('student_id'), fn ($q, $id) => $q->where('student_id', $id))
            ->when($request->input('from'), fn ($q, $from) => $q->whereDate('paid_at', '>=', $from))
            ->when($request->input('to'), fn ($q, $to) => $q->whereDate('paid_at', '<=', $to))
            ->when($request->input('search'), function ($q, $search) {
                $q->where(function ($w) use ($search) {
                    $w->where('receipt_number', 'ilike', "%{$search}%")
                        ->orWhere('payment_method', 'ilike', "%{$search}%")
                        ->orWhereRaw('amount::text ilike ?', ["%{$search}%"])
                        ->orWhereHas('student', function ($s) use ($search) {
                            $s->where('first_name', 'ilike', "%{$search}%")
                                ->orWhere('last_name', 'ilike', "%{$search}%")
                                ->orWhere('student_number', 'ilike', "%{$search}%");
                        })
                        ->orWhereHas('studentFee', fn ($f) => $f->where('invoice_number', 'ilike', "%{$search}%"));
                });
            });

        return response()->json(['data' => $query->latest('paid_at')->paginate($request->integer('per_page', 25))]);
    }

    public function recordPayment(Request $request, StudentFee $studentFee)
    {
        Gate::authorize('create', FeePayment::class);
        Gate::authorize('view', $studentFee);

        $data = $request->validate([
            'amount' => ['required', 'numeric', 'gt:0'],
            'payment_method' => ['required', 'in:cash,card,bank,online'],
            'reference' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'paid_by_name' => ['nullable', 'string', 'max:255'],
        ]);

        $payment = $this->payments->recordPayment(
            $studentFee,
            $data['amount'],
            PaymentMethod::from($data['payment_method']),
            $request->user(),
            $data['notes'] ?? null,
        );

        if (isset($data['paid_by_name'])) {
            $payment->update(['paid_by_name' => $data['paid_by_name']]);
        }

        return response()->json(['data' => $payment], 201);
    }

    public function receipt(Request $request, FeePayment $payment)
    {
        Gate::authorize('view', $payment);

        $payment->load(['student.class', 'studentFee.feeType', 'receivedBy']);

        return response()->json(['data' => $payment]);
    }

    public function receiptPdf(Request $request, FeePayment $payment)
    {
        Gate::authorize('view', $payment);

        $school = app(TenantContext::class)->school();
        $payment->load(['student', 'studentFee', 'receivedBy']);

        $pdf = Pdf::loadView('pdf.receipt', [
            'school' => $school,
            'payment' => $payment,
        ])->setPaper('a4');

        return $pdf->download("receipt-{$payment->receipt_number}.pdf");
    }

    public function summary(Request $request)
    {
        Gate::authorize('view', StudentFee::class);

        $school = app(TenantContext::class)->school();

        $invoices = StudentFee::query()->where('status', '!=', 'cancelled')->get();

        return response()->json([
            'total_invoiced' => round($invoices->sum('amount'), 2),
            'total_discounted' => round($invoices->sum('discount_amount'), 2),
            'total_paid' => round($school->feePayments()->sum('amount'), 2),
            'outstanding' => round($invoices->sum(fn ($f) => $f->outstandingAmount()), 2),
            'by_type' => FeeType::query()->with('studentFees')->get()->map(function ($type) {
                return [
                    'name' => $type->name,
                    'invoiced' => round($type->studentFees->sum('amount'), 2),
                    'paid' => round($type->studentFees->sum(fn ($f) => $f->paidAmount()), 2),
                ];
            }),
        ]);
    }
}
