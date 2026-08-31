<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Http\Client\Response;
use RuntimeException;

/**
 * Mengirim foto makanan ke Google Gemini (multimodal) untuk deteksi
 * jenis makanan, estimasi porsi, dan kandungan kalori/makronutrisi.
 */
class FoodVisionService
{
    private string $apiKey;
    private string $model;

    public function __construct()
    {
        $this->apiKey = config('services.gemini.key');
        $this->model = config('services.gemini.vision_model', 'gemini-3.6-flash');
    }

    /**
     * @param string $imageBinary isi mentah file gambar (bytes)
     * @param string $mimeType    mis. 'image/jpeg', 'image/png'
     * @return array{food_name: string, calories: int, carbs_g: float, protein_g: float, fat_g: float, portion_estimate: float, raw: array}
     */
    public function analyzeFoodImage(string $imageBinary, string $mimeType): array
    {
        $prompt = <<<PROMPT
        Kamu adalah asisten nutrisi. Analisis foto makanan ini dan balas HANYA
        dengan JSON valid, tanpa markdown/backtick, format persis:
        {
          "food_name": "nama makanan",
          "portion_estimate": angka_gram,
          "calories": angka_kkal,
          "carbs_g": angka,
          "protein_g": angka,
          "fat_g": angka
        }
        PROMPT;

        $url = "https://generativelanguage.googleapis.com/v1beta/models/{$this->model}:generateContent";

        // Menerapkan retry otomatis hingga 3 kali dengan jeda bertahap (1000ms, 2000ms, dst.)
        // jika server merespons dengan status 503 atau 429 (Rate Limit / Server Busy).
        $response = Http::withHeaders(['x-goog-api-key' => $this->apiKey])
            ->timeout(60)
            ->retry(3, 1000, function ($exception, $request) {
                if ($exception instanceof \Illuminate\Http\Client\RequestException) {
                    $status = $exception->response->status();
                    return $status === 503 || $status === 429;
                }
                return false;
            })
            ->post($url, [
                'contents' => [[
                    'parts' => [
                        ['text' => $prompt],
                        [
                            'inline_data' => [
                                'mime_type' => $mimeType,
                                'data' => base64_encode($imageBinary),
                            ],
                        ],
                    ],
                ]],
                'generationConfig' => [
                    'response_mime_type' => 'application/json',
                ],
            ]);

        if ($response->failed()) {
            throw new RuntimeException('Food vision API gagal setelah beberapa kali mencoba: ' . $response->body());
        }

        $raw = $response->json();
        $text = $raw['candidates'][0]['content']['parts'][0]['text'] ?? '{}';
        $parsed = json_decode($text, true) ?? [];

        return [
            'food_name' => $parsed['food_name'] ?? 'Tidak dikenali',
            'portion_estimate' => (float) ($parsed['portion_estimate'] ?? 0),
            'calories' => (int) ($parsed['calories'] ?? 0),
            'carbs_g' => (float) ($parsed['carbs_g'] ?? 0),
            'protein_g' => (float) ($parsed['protein_g'] ?? 0),
            'fat_g' => (float) ($parsed['fat_g'] ?? 0),
            'raw' => $raw,
        ];
    }
}