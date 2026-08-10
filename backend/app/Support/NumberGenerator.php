<?php

namespace App\Support;

class NumberGenerator
{
    public static function studentNumber(int $schoolId): string
    {
        return 'STU-'.now()->year.'-'.self::nextSequence('students', 'student_number', $schoolId);
    }

    public static function admissionNumber(int $schoolId): string
    {
        return 'ADM-'.now()->format('Ymd').'-'.self::nextSequence('students', 'admission_number', $schoolId);
    }

    public static function employeeId(int $schoolId): string
    {
        return 'EMP-'.now()->year.'-'.self::nextSequence('teachers', 'employee_id', $schoolId);
    }

    public static function invoiceNumber(int $schoolId): string
    {
        return 'INV-'.now()->format('Y').'-'.str_pad(self::nextSequence('student_fees', 'invoice_number', $schoolId), 6, '0', STR_PAD_LEFT);
    }

    public static function receiptNumber(int $schoolId): string
    {
        return 'REC-'.now()->format('Y').'-'.str_pad(self::nextSequence('fee_payments', 'receipt_number', $schoolId), 6, '0', STR_PAD_LEFT);
    }

    private static function nextSequence(string $table, string $column, int $schoolId): int
    {
        return (int) \Illuminate\Support\Facades\DB::table($table)
            ->where('school_id', $schoolId)
            ->count() + 1;
    }
}
