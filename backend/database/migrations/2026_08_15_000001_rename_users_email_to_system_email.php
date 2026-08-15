<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->renameColumn('email', 'system_email');
            $table->string('email')->nullable()->index()->after('system_email');
            $table->string('activation_token', 60)->nullable()->after('email');
            $table->timestamp('activation_token_expires_at')->nullable()->after('activation_token');
            $table->timestamp('activated_at')->nullable()->after('activation_token_expires_at');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['activated_at', 'activation_token_expires_at', 'activation_token', 'email']);
            $table->renameColumn('system_email', 'email');
        });
    }
};
