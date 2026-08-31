<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HealthProfile extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'age',
        'gender',
        'weight_kg',
        'height_cm',
        'activity_level',
        'goal',
        'bmr',
        'tdee',
        'calorie_target',
    ];

    protected $casts = [
        'weight_kg' => 'decimal:2',
        'height_cm' => 'decimal:2',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
