<?php

namespace App\Models;

use App\Enums\UserStatus;
use App\Support\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, HasRoles;

    protected $fillable = [
        'school_id', 'name', 'email', 'phone', 'password', 'locale', 'timezone',
        'avatar', 'status', 'must_change_password', 'last_login_at', 'last_login_ip',
    ];

    protected $hidden = ['password', 'remember_token'];

    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'email_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'must_change_password' => 'boolean',
            'status' => UserStatus::class,
        ];
    }

    public function school(): BelongsTo
    {
        return $this->belongsTo(School::class);
    }

    public function student(): \Illuminate\Database\Eloquent\Relations\HasOne
    {
        return $this->hasOne(Student::class);
    }

    public function teacher(): \Illuminate\Database\Eloquent\Relations\HasOne
    {
        return $this->hasOne(Teacher::class);
    }

    public function guardians(): HasMany
    {
        return $this->hasMany(Guardian::class);
    }

    public function notificationsSent(): HasMany
    {
        return $this->hasMany(Notification::class);
    }

    public function isStaff(): bool
    {
        return $this->hasAnyRole(['super_admin', 'admin', 'accountant', 'teacher']);
    }

    public function linkedStudentIds(): array
    {
        $ids = $this->student ? [$this->student->id] : [];

        foreach ($this->guardians()->with('students:id')->get() as $guardian) {
            foreach ($guardian->students as $student) {
                $ids[] = $student->id;
            }
        }

        return array_values(array_unique(array_filter($ids)));
    }
}
