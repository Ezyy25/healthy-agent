<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FoodItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'nutrition_log_id',
        'food_name',
        'image_url',
        'calories',
        'carbs_g',
        'protein_g',
        'fat_g',
        'portion_estimate',
        'source_type',
        'ai_raw_response',
    ];

    protected $casts = [
        'ai_raw_response' => 'array',
    ];

    public function nutritionLog(): BelongsTo
    {
        return $this->belongsTo(NutritionLog::class);
    }

    protected static function booted(): void
    {
        // Otomatis update total di NutritionLog tiap kali FoodItem berubah
        static::saved(fn (FoodItem $item) => $item->nutritionLog->recalculateTotals());
        static::deleted(fn (FoodItem $item) => $item->nutritionLog->recalculateTotals());
    }
}
