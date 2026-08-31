<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Insight/rekomendasi yang dihasilkan LLM berdasarkan tren 7 hari terakhir.
     */
    public function up(): void
    {
        Schema::create('health_insights', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();

            $table->text('insight_text');
            $table->enum('category', ['WARNING', 'TIP', 'PRAISE'])->default('TIP');

            // Rentang data yang dianalisis, untuk keperluan tampilan/debug
            $table->date('period_start')->nullable();
            $table->date('period_end')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('health_insights');
    }
};
