<?php

namespace App\Models;

use App\Support\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssignmentAttachment extends Model
{
    use BelongsToSchool;

    protected $fillable = ['school_id', 'assignment_id', 'name', 'path', 'mime_type', 'size'];

    public function assignment(): BelongsTo
    {
        return $this->belongsTo(Assignment::class);
    }
}
