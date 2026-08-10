<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('schools', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('logo')->nullable();
            $table->string('address')->nullable();
            $table->string('city')->nullable();
            $table->string('country')->nullable();
            $table->string('phone')->nullable();
            $table->string('email')->nullable();
            $table->string('website')->nullable();
            $table->string('currency', 3)->default('USD');
            $table->string('timezone', 64)->default('UTC');
            $table->string('status', 16)->default('trial'); // trial | active | suspended
            $table->string('subscription_plan', 32)->default('starter'); // starter | professional | enterprise
            $table->unsignedInteger('student_limit')->nullable();
            $table->unsignedInteger('teacher_limit')->nullable();
            $table->unsignedBigInteger('current_academic_year_id')->nullable();
            $table->timestamps();
        });

        Schema::create('academic_years', function (Blueprint $table) {
            $table->id();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->string('name'); // e.g. 2026/2027
            $table->date('start_date');
            $table->date('end_date');
            $table->boolean('is_current')->default(false);
            $table->string('status', 16)->default('active');
            $table->timestamps();
            $table->unique(['school_id', 'name']);
        });

        Schema::table('schools', function (Blueprint $table) {
            $table->foreign('current_academic_year_id')->references('id')->on('academic_years')->nullOnDelete();
        });

        Schema::create('terms', function (Blueprint $table) {
            $table->id();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->foreignId('academic_year_id')->constrained()->cascadeOnDelete();
            $table->string('name'); // Term 1
            $table->unsignedTinyInteger('term_number');
            $table->date('start_date');
            $table->date('end_date');
            $table->boolean('is_current')->default(false);
            $table->timestamps();
            $table->unique(['school_id', 'academic_year_id', 'term_number']);
        });

        Schema::create('school_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->string('key');
            $table->text('value')->nullable();
            $table->timestamps();
            $table->unique(['school_id', 'key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('school_settings');
        Schema::dropIfExists('terms');
        Schema::dropIfExists('academic_years');
        Schema::dropIfExists('schools');
    }
};
