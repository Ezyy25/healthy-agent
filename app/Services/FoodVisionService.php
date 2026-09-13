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
 *
 * Mendukung 1-3 foto sekaligus (mis. beberapa sudut piring yang sama)
 * supaya AI bisa mempertimbangkan lebih banyak informasi visual sebelum
 * memberi satu estimasi gabungan yang lebih akurat.
 */
class FoodVisionService
{
    /**
     * @param array<int, array{binary: string, mime: string}> $images 1-3 foto, tiap item berisi isi mentah file & mime type-nya.
     * @return array{food_name: string, calories: int, carbs_g: float, protein_g: float, fat_g: float, portion_estimate: float, micronutrients: array{natrium_mg: float, kalium_mg: float, magnesium_mg: float}, raw: array}
     */
    public function analyzeFoodImages(array $images): array
    {
        if (count($images) < 1 || count($images) > 3) {
            throw new RuntimeException('Jumlah foto harus antara 1 sampai 3.');
        }

        $prompt = $this->prompt(count($images));

        try {
            return $this->analyzeWithGemini($images, $prompt);
        } catch (\Throwable $primaryError) {
            \Illuminate\Support\Facades\Log::warning('Gemini food-scan gagal: ' . $primaryError->getMessage());

            // Tangkap SEMUA jenis error (bukan cuma RuntimeException) —
            // termasuk ConnectionException dari timeout/gagal konek,
            // supaya fallback ke OpenAI selalu kepicu kalau Gemini
            // bermasalah dengan cara apapun.
            if (!config('services.openai.key')) {
                throw $primaryError;
            }

            try {
                return $this->analyzeWithOpenAi($images, $prompt);
            } catch (\Throwable $fallbackError) {
                \Illuminate\Support\Facades\Log::error('OpenAI food-scan fallback juga gagal: ' . $fallbackError->getMessage());

                $statusCode = str_contains($fallbackError->getMessage(), '(429)')
                    ? 429
                    : 503;

                throw new AiProviderUnavailableException(
                    $statusCode === 429
                        ? 'Provider AI sedang terkena rate limit. Gemini gagal sementara dan OpenAI mencapai batas kuota. Coba lagi beberapa saat lagi.'
                        : 'Provider AI utama dan cadangan sedang tidak tersedia. Periksa konfigurasi Gemini/OpenAI, atau coba lagi beberapa saat lagi.',
                    $statusCode,
                    previous: $fallbackError,
                );
            }
        }
    }

    private function prompt(int $imageCount): string
    {
        $angleNote = $imageCount > 1
            ? "Kamu menerima {$imageCount} foto dari HIDANGAN YANG SAMA, diambil dari sudut/jarak berbeda "
                . "(mis. tampak atas, tampak samping, close-up bahan). Gunakan SEMUA foto ini bersama-sama "
                . "untuk memperkirakan porsi dan kandungan gizi dengan lebih akurat, karena satu sudut saja "
                . "sering menyembunyikan bahan atau meremehkan ukuran porsi. Balas dengan SATU hasil gabungan saja, "
                . "bukan satu hasil per foto."
            : "Kamu menerima 1 foto makanan.";

        return <<<PROMPT
        Kamu adalah asisten nutrisi. {$angleNote}

        Analisis foto(-foto) ini dan balas HANYA dengan JSON valid, tanpa
        markdown/backtick, format persis:
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

    /**
     * @param array<int, array{binary: string, mime: string}> $images
     */
    private function analyzeWithGemini(array $images, string $prompt): array
    {
        $apiKey = config('services.gemini.key');
        $model = config('services.gemini.vision_model', 'gemini-2.5-flash');
        if (!$apiKey) {
            throw new RuntimeException('GEMINI_API_KEY belum dikonfigurasi.');
        }

        $url = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent";

        // Setiap foto jadi satu "part" inline_data terpisah dalam satu
        // request yang sama, supaya Gemini melihat semuanya sekaligus
        // sebagai konteks satu hidangan, bukan sebagai request terpisah.
        $parts = [['text' => $prompt]];
        foreach ($images as $image) {
            $parts[] = [
                'inline_data' => [
                    'mime_type' => $image['mime'],
                    'data' => base64_encode($image['binary']),
                ],
            ];
        }

        $response = Http::withHeaders(['x-goog-api-key' => $apiKey])
            ->timeout(60)
            ->connectTimeout(15)
            ->retry(2, 1000, throw: false)
            ->post($url, [
                'contents' => [['parts' => $parts]],
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

    /**
     * @param array<int, array{binary: string, mime: string}> $images
     */
    private function analyzeWithOpenAi(array $images, string $prompt): array
    {
        $apiKey = config('services.openai.key');
        $model = config('services.openai.vision_model', 'gpt-4o-mini');
        if (!$apiKey) {
            throw new RuntimeException('OPENAI_API_KEY belum dikonfigurasi.');
        }

        $content = [['type' => 'text', 'text' => $prompt]];
        foreach ($images as $image) {
            $content[] = [
                'type' => 'image_url',
                'image_url' => [
                    'url' => 'data:' . $image['mime'] . ';base64,' . base64_encode($image['binary']),
                ],
            ];
        }

        $response = Http::withToken($apiKey)
            ->acceptJson()
            ->timeout(60)
            ->post('https://api.openai.com/v1/chat/completions', [
                'model' => $model,
                'response_format' => ['type' => 'json_object'],
                'messages' => [[
                    'role' => 'user',
                    'content' => $content,
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