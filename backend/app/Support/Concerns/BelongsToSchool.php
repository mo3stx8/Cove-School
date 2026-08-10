<?php

namespace App\Support\Concerns;

use App\Support\TenantContext;
use Illuminate\Database\Eloquent\Builder;

/**
 * Scopes a model to the current school/tenant for every query.
 *
 * Tenant isolation is derived server-side from the authenticated user's
 * school — never from client input.
 */
trait BelongsToSchool
{
    public static function bootBelongsToSchool(): void
    {
        static::addGlobalScope('school', function (Builder $builder) {
            $schoolId = app(TenantContext::class)->schoolId();

            if ($schoolId) {
                $builder->where($builder->qualifyColumn('school_id'), $schoolId);
            }
        });

        static::creating(function ($model) {
            if (empty($model->school_id)) {
                $schoolId = app(TenantContext::class)->schoolId();

                if ($schoolId) {
                    $model->school_id = $schoolId;
                }
            }
        });
    }

    public function scopeForSchool(Builder $query, int $schoolId): Builder
    {
        return $query->withoutGlobalScope('school')->where($query->qualifyColumn('school_id'), $schoolId);
    }
}
