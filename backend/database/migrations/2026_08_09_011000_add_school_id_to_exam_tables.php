<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('exam_subjects', function (Blueprint $table) {
            $table->foreignId('school_id')->nullable()->after('id')->constrained('schools')->cascadeOnDelete();
        });

        Schema::table('exam_results', function (Blueprint $table) {
            $table->foreignId('school_id')->nullable()->after('id')->constrained('schools')->cascadeOnDelete();
        });

        Schema::table('attendance_records', function (Blueprint $table) {
            $table->foreignId('school_id')->nullable()->after('id')->constrained('schools')->cascadeOnDelete();
        });

        Schema::table('assignment_submissions', function (Blueprint $table) {
            $table->foreignId('school_id')->nullable()->after('id')->constrained('schools')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        foreach (['exam_subjects', 'exam_results', 'attendance_records', 'assignment_submissions'] as $table) {
            if (Schema::hasColumn($table, 'school_id')) {
                Schema::table($table, fn (Blueprint $t) => $t->dropConstrainedForeignId('school_id'));
            }
        }
    }
};
