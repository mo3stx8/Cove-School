<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('parents', function (Blueprint $table) {
            $table->string('name')->nullable();
            $table->string('system_email')->nullable()->index()->after('email');
        });

        DB::statement(<<<'SQL'
            UPDATE parents
            SET name = NULLIF(
                COALESCE(
                    NULLIF(father_name, ''),
                    NULLIF(mother_name, ''),
                    NULLIF(guardian_name, ''),
                    email
                ),
                ''
            )
            WHERE name IS NULL
        SQL);

        DB::statement(<<<'SQL'
            UPDATE parents p
            SET system_email = u.system_email
            FROM users u
            WHERE p.user_id = u.id
              AND p.system_email IS NULL
        SQL);

        Schema::table('parents', function (Blueprint $table) {
            $table->dropColumn(['father_name', 'mother_name', 'guardian_name']);
        });
    }

    public function down(): void
    {
        Schema::table('parents', function (Blueprint $table) {
            $table->string('father_name')->nullable();
            $table->string('mother_name')->nullable();
            $table->string('guardian_name')->nullable();
        });

        DB::statement(<<<'SQL'
            UPDATE parents
            SET guardian_name = name,
                father_name = CASE WHEN relationship = 'father' THEN name END,
                mother_name = CASE WHEN relationship = 'mother' THEN name END
        SQL);

        Schema::table('parents', function (Blueprint $table) {
            $table->dropColumn(['system_email', 'name']);
        });
    }
};
