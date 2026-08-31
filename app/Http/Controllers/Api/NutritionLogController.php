<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class NutritionLogController extends Controller
{
    // GET /api/v1/nutrition-logs?date=2026-08-26
    public function show(Request $request)
    {
        $date = $request->query('date', now()->toDateString());

        $log = $request->user()->nutritionLogs()
            ->with('foodItems')
            ->firstOrCreate(['date' => $date]);

        return response()->json($log);
    }

    // POST /api/v1/nutrition-logs/water  { "amount_ml": 250 }
    public function addWater(Request $request)
    {
        $data = $request->validate(['amount_ml' => 'required|integer|min:1|max:5000']);

        $log = $request->user()->nutritionLogs()
            ->firstOrCreate(['date' => now()->toDateString()]);

        $log->increment('water_intake_ml', $data['amount_ml']);

        return response()->json($log->fresh());
    }
}
