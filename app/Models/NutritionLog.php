<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class NutritionLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'date',
        'total_calories',
        'carbs_g',
        'protein_g',
        'fat_g',
        'water_intake_ml',
    ];

    protected $casts = [
        'date' => 'date',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function foodItems(): HasMany
    {
        return $this->hasMany(FoodItem::class);
    }

    /**
     * Recalculate totals berdasarkan semua food_items yang terkait.
     * Panggil ini setelah menambah/menghapus FoodItem.
     */
    public function recalculateTotals(): void
    {
        $this->total_calories = $this->foodItems()->sum('calories');
        $this->carbs_g = $this->foodItems()->sum('carbs_g');
        $this->protein_g = $this->foodItems()->sum('protein_g');
        $this->fat_g = $this->foodItems()->sum('fat_g');
        $this->save();
    }
}
