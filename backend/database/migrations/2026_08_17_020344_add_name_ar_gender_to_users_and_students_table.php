<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('name_ar')->nullable()->after('name');
            $table->string('gender', 16)->nullable()->after('phone');
        });

        Schema::table('students', function (Blueprint $table) {
            $table->string('first_name_ar')->nullable()->after('first_name');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['name_ar', 'gender']);
        });

        Schema::table('students', function (Blueprint $table) {
            $table->dropColumn('first_name_ar');
        });
    }
};
