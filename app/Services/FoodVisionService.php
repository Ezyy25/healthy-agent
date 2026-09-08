<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use RuntimeException;

class AiProviderUnavailableException extends RuntimeException
{
    public function __construct(string $message, public readonly int $statusCode = 503, ?\Throwable $previous = null)
    {
        parent::__construct($message, 0, $previous);
    }
}

/**
 * Mengirim foto makanan ke Google Gemini (multimodal) untuk deteksi
 * jenis makanan, estimasi porsi, kandungan kalori/makronutrisi, dan mineral.
 */
class FoodVisionService
{
    /**
     * @param string $imageBinary isi mentah file gambar (bytes)
     * @param string $mimeType    mis. 'image/jpeg', 'image/png'
    * @return array{food_name: string, calories: int, carbs_g: float, protein_g: float, fat_g: float, portion_estimate: float, micronutrients: array{natrium_mg: float, kalium_mg: float, magnesium_mg: float}, raw: array}
     */
    public function analyzeFoodImage(string $imageBinary, string $mimeType): array
    {
        $prompt = $this->prompt();

        try {
            return $this->analyzeWithGemini($imageBinary, $mimeType, $prompt);
        } catch (RuntimeException $primaryError) {
            // Kuota/rate limit provider utama harus pindah ke provider cadangan.
            if (!config('services.openai.key')) {
                throw $primaryError;
            }

            try {
                return $this->analyzeWithOpenAi($imageBinary, $mimeType, $prompt);
            } catch (RuntimeException $fallbackError) {
                $statusCode = str_contains($fallbackError->getMessage(), '(429)')
                    ? 429
                    : 503;

                throw new AiProviderUnavailableException(
                    $statusCode === 429
                        ? 'Provider AI sedang terkena rate limit. Gemini gagal sementara dan OpenAI mencapai batas kuota. Coba lagi beberapa saat lagi.'
                        : 'Provider AI utama dan cadangan sedang tidak tersedia. Periksa konfigurasi Gemini/OpenAI.',
                    $statusCode,
                    previous: $fallbackError,
                );
            }
        }
    }

    private function prompt(): string
    {
        return <<<PROMPT
        Kamu adalah asisten nutrisi. Analisis foto makanan ini dan balas HANYA
        dengan JSON valid, tanpa markdown/backtick, format persis:
        {
          "food_name": "nama makanan",
          "portion_estimate": angka_gram,
          "calories": angka_kkal,
          "carbs_g": angka,
          "protein_g": angka,
                    "fat_g": angka,
                    "micronutrients": {
                        "natrium_mg": angka,
                        "kalium_mg": angka,
                        "magnesium_mg": angka
                    }
        }
                Estimasikan mineral dalam miligram berdasarkan makanan dan ukuran porsinya.
                Gunakan 0 bila mineral tidak bermakna. Semua field wajib dikembalikan.
        PROMPT;
    }

    private function analyzeWithGemini(
        string $imageBinary,
        string $mimeType,
        string $prompt,
    ): array {
        $apiKey = config('services.gemini.key');
        $model = config('services.gemini.vision_model', 'gemini-2.5-flash');
        if (!$apiKey) {
            throw new RuntimeException('GEMINI_API_KEY belum dikonfigurasi.');
        }

        $url = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent";

        $response = Http::withHeaders(['x-goog-api-key' => $apiKey])
            ->timeout(45)
            ->connectTimeout(10)
            ->retry(2, 1000, throw: false)
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
            throw new RuntimeException('Gemini gagal (' . $response->status() . ').');
        }

        $raw = $response->json();
        $text = $raw['candidates'][0]['content']['parts'][0]['text'] ?? '{}';
        return $this->normalizeResult($text, $raw);
    }

    private function analyzeWithOpenAi(
        string $imageBinary,
        string $mimeType,
        string $prompt,
    ): array {
        $apiKey = config('services.openai.key');
        $model = config('services.openai.vision_model', 'gpt-4o-mini');
        if (!$apiKey) {
            throw new RuntimeException('OPENAI_API_KEY belum dikonfigurasi.');
        }

        $response = Http::withToken($apiKey)
            ->acceptJson()
            ->timeout(45)
            ->post('https://api.openai.com/v1/chat/completions', [
                'model' => $model,
                'response_format' => ['type' => 'json_object'],
                'messages' => [[
                    'role' => 'user',
                    'content' => [
                        ['type' => 'text', 'text' => $prompt],
                        [
                            'type' => 'image_url',
                            'image_url' => [
                                'url' => 'data:' . $mimeType . ';base64,' . base64_encode($imageBinary),
                            ],
                        ],
                    ],
                ]],
            ]);

        if ($response->failed()) {
            throw new RuntimeException('OpenAI gagal (' . $response->status() . ').');
        }

        $raw = $response->json();
        $text = $raw['choices'][0]['message']['content'] ?? '{}';
        return $this->normalizeResult($text, $raw);
    }

    private function normalizeResult(string $text, array $raw): array
    {
        $parsed = json_decode(trim($text), true);
        if (!is_array($parsed)) {
            throw new RuntimeException('Respons AI bukan JSON yang valid.');
        }

        return [
            'food_name' => $parsed['food_name'] ?? 'Tidak dikenali',
            'portion_estimate' => (float) ($parsed['portion_estimate'] ?? 0),
            'calories' => (int) ($parsed['calories'] ?? 0),
            'carbs_g' => (float) ($parsed['carbs_g'] ?? 0),
            'protein_g' => (float) ($parsed['protein_g'] ?? 0),
            'fat_g' => (float) ($parsed['fat_g'] ?? 0),
            'micronutrients' => [
                'natrium_mg' => (float) ($parsed['micronutrients']['natrium_mg'] ?? 0),
                'kalium_mg' => (float) ($parsed['micronutrients']['kalium_mg'] ?? 0),
                'magnesium_mg' => (float) ($parsed['micronutrients']['magnesium_mg'] ?? 0),
            ],
            'raw' => $raw,
        ];
    }
}