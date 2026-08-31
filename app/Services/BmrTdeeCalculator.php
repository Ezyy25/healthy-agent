<?php

namespace App\Services;

use App\Models\HealthProfile;

/**
 * Kalkulasi BMR & TDEE murni matematika (rumus Mifflin-St Jeor).
 * Tidak butuh AI — cepat, akurat, dan tidak ada biaya API.
 */
class BmrTdeeCalculator
{
    private const ACTIVITY_MULTIPLIERS = [
        'sedentary'   => 1.2,
        'light'       => 1.375,
        'moderate'    => 1.55,
        'active'      => 1.725,
        'very_active' => 1.9,
    ];

    /**
     * Mifflin-St Jeor Equation:
     * Pria:   BMR = 10*berat(kg) + 6.25*tinggi(cm) - 5*umur + 5
     * Wanita: BMR = 10*berat(kg) + 6.25*tinggi(cm) - 5*umur - 161
     */
    public function calculateBmr(HealthProfile $profile): float
    {
        $base = (10 * $profile->weight_kg)
            + (6.25 * $profile->height_cm)
            - (5 * $profile->age);

        return $profile->gender === 'male' ? $base + 5 : $base - 161;
    }

    public function calculateTdee(HealthProfile $profile): float
    {
        $bmr = $this->calculateBmr($profile);
        $multiplier = self::ACTIVITY_MULTIPLIERS[$profile->activity_level] ?? 1.2;

        return $bmr * $multiplier;
    }

    /**
     * Target kalori harian berdasarkan goal.
     * Defisit/surplus 500 kkal = kira-kira 0.5 kg/minggu, standar aman.
     */
    public function calculateCalorieTarget(HealthProfile $profile): int
    {
        $tdee = $this->calculateTdee($profile);

        $target = match ($profile->goal) {
            'lose_weight'  => $tdee - 500,
            'gain_muscle'  => $tdee + 300,
            default        => $tdee, // maintain
        };

        return (int) round($target);
    }

    /**
     * Hitung semua sekaligus dan simpan ke profile.
     */
    public function calculateAndSave(HealthProfile $profile): HealthProfile
    {
        $profile->bmr = (int) round($this->calculateBmr($profile));
        $profile->tdee = (int) round($this->calculateTdee($profile));
        $profile->calorie_target = $this->calculateCalorieTarget($profile);
        $profile->save();

        return $profile;
    }
}
