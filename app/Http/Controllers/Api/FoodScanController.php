<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\FoodVisionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

class FoodScanController extends Controller
{
    public function __construct(private FoodVisionService $vision) {}

    // POST /api/v1/food/scan  (multipart: image)
    public function scan(Request $request)
    {
        $request->validate([
            'image' => 'required|image|max:20480', // max 20MB
        ]);

        $file = $request->file('image');

        // Tetap simpan gambarnya di storage untuk riwayat/tampilan di app,
        // tapi untuk analisis AI, Gemini butuh isi file (base64), bukan URL.
        $path = $file->store('food-scans', 'public');
        $imageUrl = Storage::disk('public')->url($path);

        try {
            $result = $this->vision->analyzeFoodImage(
                $file->get(),
                $file->getMimeType()
            );
        } catch (RuntimeException $exception) {
            return response()->json([
                'message' => $exception->getMessage(),
                'code' => 'food_scan_providers_unavailable',
            ], 503);
        }

        $log = $request->user()->nutritionLogs()
            ->firstOrCreate(['date' => now()->toDateString()]);

        $foodItem = $log->foodItems()->create([
            'food_name' => $result['food_name'],
            'image_url' => $imageUrl,
            'calories' => $result['calories'],
            'carbs_g' => $result['carbs_g'],
            'protein_g' => $result['protein_g'],
            'fat_g' => $result['fat_g'],
            'portion_estimate' => $result['portion_estimate'],
            'micronutrients' => $result['micronutrients'],
            'source_type' => 'SCAN',
            'ai_raw_response' => $result['raw'],
        ]);

        return response()->json($foodItem, 201);
    }
}