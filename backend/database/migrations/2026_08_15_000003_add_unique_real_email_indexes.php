<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Real contact emails must be unique so one address cannot be assigned
        // to two different people (student / father / mother / teacher).
        // Existing duplicate rows are de-duplicated (keep the oldest row).

        DB::statement(<<<'SQL'
            UPDATE users u
            SET email = NULL
            WHERE email IS NOT NULL
              AND id NOT IN (
                  SELECT MIN(id) FROM users WHERE email IS NOT NULL GROUP BY lower(email)
              )
        SQL);

        DB::statement(<<<'SQL'
            UPDATE parents p
            SET email = NULL
            WHERE email IS NOT NULL
              AND id NOT IN (
                  SELECT MIN(id) FROM parents WHERE email IS NOT NULL GROUP BY lower(email)
              )
        SQL);

        Schema::table('users', function (Illuminate\Database\Schema\Blueprint $table) {
            $table->dropIndex('users_email_index');
        });

        DB::statement('CREATE UNIQUE INDEX users_email_unique_real ON users (lower(email)) WHERE email IS NOT NULL');
        DB::statement('CREATE UNIQUE INDEX parents_email_unique_real ON parents (lower(email)) WHERE email IS NOT NULL');
    }

    public function down(): void
    {
        Schema::table('users', function (Illuminate\Database\Schema\Blueprint $table) {
            $table->index('email', 'users_email_index');
        });

        DB::statement('DROP INDEX IF EXISTS users_email_unique_real');
        DB::statement('DROP INDEX IF EXISTS parents_email_unique_real');
    }
};
