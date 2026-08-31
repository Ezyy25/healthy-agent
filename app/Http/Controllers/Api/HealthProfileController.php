<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\BmrTdeeCalculator;
use Illuminate\Http\Request;

class HealthProfileController extends Controller
{
    public function __construct(private BmrTdeeCalculator $calculator) {}

    // GET /api/v1/profile
    public function show(Request $request)
    {
        return response()->json($request->user()->healthProfile);
    }

    // POST /api/v1/profile  (create atau update)
    public function store(Request $request)
    {
        $data = $request->validate([
            'age' => 'required|integer|min:10|max:100',
            'gender' => 'required|in:male,female',
            'weight_kg' => 'required|numeric|min:20|max:300',
            'height_cm' => 'required|numeric|min:100|max:250',
            'activity_level' => 'required|in:sedentary,light,moderate,active,very_active',
            'goal' => 'required|in:lose_weight,maintain,gain_muscle',
        ]);

        $profile = $request->user()->healthProfile()->updateOrCreate(
            ['user_id' => $request->user()->id],
            $data
        );

        $this->calculator->calculateAndSave($profile);

        return response()->json($profile->fresh(), 200);
    }
}
