<?php

namespace App\Services;

use App\Models\HealthProfile;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Menganalisis tren 7 hari terakhir via Google Gemini API dan menghasilkan
 * insight/rekomendasi kesehatan personal.
 *
 * Wajib set GEMINI_API_KEY di .env (ambil gratis di aistudio.google.com,
 * tidak perlu kartu kredit untuk free tier).
 */
class HealthRecommendationService
{
    private string $apiKey;
    private string $model;

    public function __construct()
    {
        $this->apiKey = config('services.gemini.key');
        $this->model = config('services.gemini.text_model', 'gemini-3.6-flash');
    }

    /**
     * @return array{insight_text: string, category: string}
     */
    public function generateInsight(User $user): array
    {
        $profile = $user->healthProfile;
        $recentLogs = $user->nutritionLogs()
            ->where('date', '>=', now()->subDays(7))
            ->orderBy('date')
            ->get(['date', 'total_calories', 'water_intake_ml']);

        if ($recentLogs->isEmpty()) {
            return [
                'insight_text' => 'Belum ada data 7 hari terakhir. Mulai catat makanan harianmu untuk mendapat rekomendasi personal.',
                'category' => 'TIP',
            ];
        }

        $context = $this->buildContext($profile, $recentLogs);
        $prompt = "Kamu adalah health coach yang suportif dan berbasis data. "
            . "Balas HANYA JSON valid, tanpa markdown/backtick, format persis: "
            . '{"insight_text": "...", "category": "WARNING|TIP|PRAISE"}. '
            . "insight_text maksimal 3 kalimat, bahasa Indonesia, actionable, tidak menghakimi.\n\n"
            . $context;

        $url = "https://generativelanguage.googleapis.com/v1beta/models/{$this->model}:generateContent";

        // Timeout dinaikkan ke 60 detik, sama seperti FoodVisionService,
        // supaya tidak keburu di-cancel kalau koneksi/respons AI agak lambat.
        $response = Http::withHeaders(['x-goog-api-key' => $this->apiKey])
            ->timeout(60)
            ->post($url, [
                'contents' => [
                    ['parts' => [['text' => $prompt]]],
                ],
                'generationConfig' => [
                    'response_mime_type' => 'application/json',
                ],
            ]);

        if ($response->failed()) {
            throw new RuntimeException('Health recommendation API gagal: ' . $response->body());
        }

        $text = $response->json('candidates.0.content.parts.0.text', '{}');
        $parsed = json_decode($text, true) ?? [];

        return [
            'insight_text' => $parsed['insight_text'] ?? 'Tidak dapat menghasilkan insight saat ini.',
            'category' => $parsed['category'] ?? 'TIP',
        ];
    }

    private function buildContext(?HealthProfile $profile, $recentLogs): string
    {
        $target = $profile?->calorie_target ?? 'belum diatur';

        $rows = $recentLogs->map(fn ($log) =>
            "{$log->date->format('Y-m-d')}: {$log->total_calories} kkal, {$log->water_intake_ml} ml air"
        )->implode("\n");

        return <<<TEXT
        Target kalori harian: {$target} kkal
        Data 7 hari terakhir:
        {$rows}

        Analisis konsistensi asupan kalori dan hidrasi, lalu beri satu insight paling relevan.
        TEXT;
    }
}