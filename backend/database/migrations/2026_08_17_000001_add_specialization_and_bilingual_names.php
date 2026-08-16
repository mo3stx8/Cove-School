<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('teachers', function (Blueprint $table) {
            $table->string('specialization')->nullable()->after('qualification');
        });

        Schema::table('grades', function (Blueprint $table) {
            $table->string('name_ar')->nullable()->after('name');
        });

        Schema::table('classes', function (Blueprint $table) {
            $table->string('name_ar')->nullable()->after('name');
        });

        Schema::table('subjects', function (Blueprint $table) {
            $table->string('name_ar')->nullable()->after('name');
        });
    }

    public function down(): void
    {
        Schema::table('teachers', function (Blueprint $table) {
            $table->dropColumn('specialization');
        });

        Schema::table('grades', function (Blueprint $table) {
            $table->dropColumn('name_ar');
        });

        Schema::table('classes', function (Blueprint $table) {
            $table->dropColumn('name_ar');
        });

        Schema::table('subjects', function (Blueprint $table) {
            $table->dropColumn('name_ar');
        });
    }
};
