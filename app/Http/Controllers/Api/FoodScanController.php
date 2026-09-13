<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AiProviderUnavailableException;
use App\Services\FoodVisionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

class FoodScanController extends Controller
{
    public function __construct(private FoodVisionService $vision) {}

    // POST /api/v1/food/scan  (multipart: images[] — 1 sampai 3 file)
    public function scan(Request $request)
    {
        $request->validate([
            'images' => 'required|array|min:1|max:3',
            'images.*' => 'image|max:20480', // tiap foto max 20MB
        ]);

        $files = $request->file('images');

        // Simpan tiap foto ke storage (untuk riwayat/tampilan di app),
        // sekaligus siapkan isi mentahnya (binary + mime) untuk dikirim
        // sebagai satu paket ke AI vision supaya dianalisis bersamaan.
        $imageUrls = [];
        $imagesForAi = [];

        foreach ($files as $file) {
            $path = $file->store('food-scans', 'public');
            $imageUrls[] = Storage::disk('public')->url($path);
            $imagesForAi[] = [
                'binary' => $file->get(),
                'mime' => $file->getMimeType(),
            ];
        }

        try {
            $result = $this->vision->analyzeFoodImages($imagesForAi);
        } catch (AiProviderUnavailableException $exception) {
            return response()->json([
                'message' => $exception->getMessage(),
                'code' => 'food_scan_providers_unavailable',
            ], $exception->statusCode);
        } catch (\Throwable $exception) {
            return response()->json([
                'message' => 'Provider AI gagal memproses gambar. Coba lagi.',
                'code' => 'food_scan_provider_error',
            ], 503);
        }

        $log = $request->user()->nutritionLogs()
            ->firstOrCreate(['date' => now()->toDateString()]);

        // Foto pertama dipakai sebagai thumbnail utama (kolom image_url
        // di database cuma menampung 1 URL). Semua URL foto tetap
        // disimpan di ai_raw_response untuk keperluan riwayat/debug.
        $rawResponse = $result['raw'];
        $rawResponse['scan_image_urls'] = $imageUrls;

        $foodItem = $log->foodItems()->create([
            'food_name' => $result['food_name'],
            'image_url' => $imageUrls[0],
            'calories' => $result['calories'],
            'carbs_g' => $result['carbs_g'],
            'protein_g' => $result['protein_g'],
            'fat_g' => $result['fat_g'],
            'portion_estimate' => $result['portion_estimate'],
            'micronutrients' => $result['micronutrients'],
            'source_type' => 'SCAN',
            'ai_raw_response' => $rawResponse,
        ]);

        return response()->json($foodItem, 201);
    }
}