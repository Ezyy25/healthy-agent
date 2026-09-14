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
                . "(mis. tampak atas, tampak samping, close-up bahan). Foto tambahan sering mengungkap bahan "
                . "yang tersembunyi di 1 sudut saja (mis. isi di bawah sayur, kuah yang tidak kelihatan dari atas, "
                . "atau porsi yang lebih besar/kecil dari kesan foto pertama). Gabungkan semua foto sebagai satu "
                . "sumber bukti untuk SATU estimasi akhir — jangan buat hasil terpisah per foto."
            : "Kamu menerima 1 foto makanan. Kalau ada bagian hidangan yang tertutup/tidak sepenuhnya terlihat "
                . "(mis. isi di bawah topping, kuah di dasar mangkuk), asumsikan porsi wajar berdasarkan jenis "
                . "hidangannya, jangan hanya menghitung yang terlihat di permukaan.";

        return <<<PROMPT
        Kamu adalah ahli gizi berpengalaman yang biasa mengestimasi kandungan
        nutrisi makanan dari foto untuk aplikasi pelacak kalori. {$angleNote}

        Sebelum menjawab, lakukan penalaran berikut secara internal
        (JANGAN ditulis di jawaban akhir, cukup dipakai untuk sampai ke angka
        yang tepat):
        1. Identifikasi SEMUA komponen di piring/mangkuk secara terpisah
           (contoh: nasi, ayam goreng, sambal, lalapan, kerupuk) — jangan
           lewatkan komponen kecil seperti minyak/santan/kuah/gorengan tepung
           yang menambah kalori signifikan.
        2. Perkirakan metode masak tiap komponen (digoreng/direbus/dikukus/
           bersantan/dibakar) karena ini sangat mengubah kalori & lemak —
           makanan digoreng atau bersantan jauh lebih tinggi kalori & lemak
           dibanding direbus/dikukus untuk berat yang sama.
        3. Perkirakan berat/porsi tiap komponen memakai referensi visual pada
           foto (ukuran piring standar ±23-26cm, sendok makan ±15ml, kepalan
           tangan ±100g, ukuran jari/sendok yang terlihat di foto) — bukan
           tebakan kasar. Lebih baik porsi realistis sesuai porsi makan orang
           Indonesia pada umumnya daripada ekstrem terlalu besar/kecil.
        4. Jumlahkan estimasi kalori & makronutrien tiap komponen jadi total
           satu hidangan, lalu estimasikan kandungan mineral (natrium, kalium,
           magnesium) berdasarkan bahan-bahan yang teridentifikasi (mis.
           makanan bersantan/berkuah/pakai kecap-garam biasanya natrium
           tinggi; sayur/buah biasanya kalium lebih tinggi).
        5. Cek ulang: apakah total kalori masuk akal untuk 1 porsi makan
           (biasanya 300-900 kkal untuk makan berat, bukan di bawah 100 atau
           di atas 1500 kecuali porsinya memang terlihat sangat besar)?

        Setelah itu, balas HANYA dengan JSON valid (tanpa markdown/backtick,
        tanpa penjelasan tambahan), format persis:
        {
          "food_name": "nama hidangan (gabungkan komponen utama jika lebih dari satu, mis. 'Nasi + Ayam Goreng + Sambal')",
          "portion_estimate": angka_gram_total,
          "calories": angka_kkal_total,
          "carbs_g": angka,
          "protein_g": angka,
          "fat_g": angka,
          "micronutrients": {
            "natrium_mg": angka,
            "kalium_mg": angka,
            "magnesium_mg": angka
          }
        }
        Semua angka numerik (bukan string), tanpa satuan di dalam nilainya.
        Gunakan 0 hanya bila nilainya benar-benar tidak bermakna, bukan
        karena tidak yakin. Semua field wajib dikembalikan.
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