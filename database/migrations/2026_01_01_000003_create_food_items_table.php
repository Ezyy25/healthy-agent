<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Detail tiap makanan yang tercatat: hasil scan foto AI, resep, atau input manual.
     */
    public function up(): void
    {
        Schema::create('food_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('nutrition_log_id')->constrained()->cascadeOnDelete();

            $table->string('food_name');
            $table->string('image_url')->nullable();
            $table->unsignedInteger('calories');
            $table->decimal('carbs_g', 6, 2)->default(0);
            $table->decimal('protein_g', 6, 2)->default(0);
            $table->decimal('fat_g', 6, 2)->default(0);
            $table->decimal('portion_estimate', 5, 2)->nullable()->comment('estimasi porsi, mis. gram atau satuan');

            $table->enum('source_type', ['SCAN', 'MANUAL', 'RECIPE'])->default('MANUAL');

            // Metadata mentah dari respons AI vision (opsional, untuk audit/debug)
            $table->json('ai_raw_response')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('food_items');
    }
};
