<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('assignment_attachments', function (Blueprint $table) {
            $table->unsignedBigInteger('school_id')->nullable()->after('id');
        });

        DB::statement("
            UPDATE assignment_attachments a
            SET school_id = x.school_id
            FROM assignments x
            WHERE x.id = a.assignment_id AND a.school_id IS NULL
        ");

        DB::statement("
            DELETE FROM assignment_attachments
            WHERE school_id IS NULL
        ");

        Schema::table('assignment_attachments', function (Blueprint $table) {
            $table->unsignedBigInteger('school_id')->nullable(false)->change();
            $table->index('school_id');
            $table->foreign('school_id')->references('id')->on('schools')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('assignment_attachments', function (Blueprint $table) {
            $table->dropForeign(['school_id']);
            $table->dropIndex(['school_id']);
            $table->dropColumn('school_id');
        });
    }
};
