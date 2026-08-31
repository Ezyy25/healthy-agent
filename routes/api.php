<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\FoodScanController;
use App\Http\Controllers\Api\HealthInsightController;
use App\Http\Controllers\Api\HealthProfileController;
use App\Http\Controllers\Api\NutritionLogController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Healthy Agent API Routes
|--------------------------------------------------------------------------
*/

// ---- PUBLIC (tidak butuh login) ----
Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

// ---- PROTECTED (butuh header: Authorization: Bearer <token>) ----
Route::middleware('auth:sanctum')->group(function () {

    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);

    Route::prefix('v1')->group(function () {
        // Profil kesehatan & kalkulasi BMR/TDEE
        Route::get('/profile', [HealthProfileController::class, 'show']);
        Route::post('/profile', [HealthProfileController::class, 'store']);

        // Nutrition log harian
        Route::get('/nutrition-logs', [NutritionLogController::class, 'show']);
        Route::post('/nutrition-logs/water', [NutritionLogController::class, 'addWater']);

        // Scan foto makanan (AI Vision)
        Route::post('/food/scan', [FoodScanController::class, 'scan']);

        // Insight & rekomendasi kesehatan (LLM)
        Route::get('/insights', [HealthInsightController::class, 'index']);
        Route::post('/insights/generate', [HealthInsightController::class, 'generate']);
    });
});