<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Ringkasan asupan nutrisi per hari per user (1 baris = 1 hari).
     * FoodItems yang di-scan/input akan di-aggregate ke sini.
     */
    public function up(): void
    {
        Schema::create('nutrition_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->date('date');

            $table->unsignedInteger('total_calories')->default(0);
            $table->decimal('carbs_g', 6, 2)->default(0);
            $table->decimal('protein_g', 6, 2)->default(0);
            $table->decimal('fat_g', 6, 2)->default(0);
            $table->unsignedInteger('water_intake_ml')->default(0);

            $table->timestamps();

            // Satu user hanya punya satu log per tanggal
            $table->unique(['user_id', 'date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('nutrition_logs');
    }
};
