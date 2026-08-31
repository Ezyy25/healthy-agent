<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\HealthRecommendationService;
use Illuminate\Http\Request;

class HealthInsightController extends Controller
{
    public function __construct(private HealthRecommendationService $recommender) {}

    // GET /api/v1/insights  -> daftar insight tersimpan
    public function index(Request $request)
    {
        return response()->json(
            $request->user()->healthInsights()->latest()->paginate(10)
        );
    }

    // POST /api/v1/insights/generate  -> minta AI generate insight baru
    public function generate(Request $request)
    {
        $result = $this->recommender->generateInsight($request->user());

        $insight = $request->user()->healthInsights()->create([
            'insight_text' => $result['insight_text'],
            'category' => $result['category'],
            'period_start' => now()->subDays(7)->toDateString(),
            'period_end' => now()->toDateString(),
        ]);

        return response()->json($insight, 201);
    }
}
