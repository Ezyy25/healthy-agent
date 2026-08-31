<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Menyimpan profil kesehatan tiap user: dipakai untuk hitung BMR/TDEE
     * dan sebagai target harian di NutritionLog.
     */
    public function up(): void
    {
        Schema::create('health_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();

            $table->unsignedTinyInteger('age');
            $table->enum('gender', ['male', 'female']);
            $table->decimal('weight_kg', 5, 2);   // contoh: 68.50
            $table->decimal('height_cm', 5, 2);   // contoh: 170.00

            // Faktor aktivitas standar Harris-Benedict / Mifflin-St Jeor
            $table->enum('activity_level', [
                'sedentary',       // jarang olahraga
                'light',           // olahraga ringan 1-3x/minggu
                'moderate',        // olahraga sedang 3-5x/minggu
                'active',          // olahraga berat 6-7x/minggu
                'very_active',     // atlet / kerja fisik berat
            ])->default('sedentary');

            $table->enum('goal', ['lose_weight', 'maintain', 'gain_muscle'])->default('maintain');

            // Hasil kalkulasi disimpan (cache), dihitung ulang tiap profil di-update
            $table->unsignedInteger('bmr')->nullable();
            $table->unsignedInteger('tdee')->nullable();
            $table->unsignedInteger('calorie_target')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('health_profiles');
    }
};
