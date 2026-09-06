"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { api, ApiError } from "@/lib/api";
import { HealthInsight } from "@/lib/types";
import { Button } from "@/components/Button";
import { Navbar } from "@/components/Navbar";

interface PaginatedInsights {
  data: HealthInsight[];
}

const CATEGORY_STYLE: Record<
  HealthInsight["category"],
  { border: string; text: string; label: string }
> = {
  TIP: { border: "border-l-hydration", text: "text-hydration", label: "Tips" },
  WARNING: { border: "border-l-warn", text: "text-warn", label: "Perhatian" },
  PRAISE: { border: "border-l-brand", text: "text-brand", label: "Bagus" },
};

export default function InsightsPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();

  const [insights, setInsights] = useState<HealthInsight[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) router.push("/login");
  }, [isLoading, user, router]);

  function loadInsights() {
    if (!token) return;
    setIsLoadingList(true);
    api
      .get<PaginatedInsights>("/v1/insights", token)
      .then((res) => setInsights(res.data ?? []))
      .catch(() => setError("Gagal memuat riwayat insight."))
      .finally(() => setIsLoadingList(false));
  }

  useEffect(loadInsights, [token]);

  async function handleGenerate() {
    if (!token) return;
    setError(null);
    setIsGenerating(true);

    try {
      const newInsight = await api.post<HealthInsight>(
        "/v1/insights/generate",
        undefined,
        token,
      );
      setInsights((prev) => [newInsight, ...prev]);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Gagal membuat insight. Coba lagi.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  if (isLoading || !user) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p className="text-sm text-muted">Memuat…</p>
      </main>
    );
  }

  return (
    <>
      <Navbar />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-10 pb-6">
        <h1 className="font-display font-semibold text-2xl text-ink mb-8">
          Insight Kesehatan
        </h1>

        <div className="border border-line p-5 mb-8">
          <p className="text-sm text-muted mb-4">
            AI menganalisis pola makan & hidrasimu 7 hari terakhir, lalu memberi
            rekomendasi personal.
          </p>
          <Button
            variant="brand"
            onClick={handleGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? "AI sedang menganalisis…" : "Buat insight baru"}
          </Button>
          {error && (
            <p className="text-sm text-energy bg-energy-soft px-3 py-2 mt-3">
              {error}
            </p>
          )}
        </div>

        <p className="text-xs text-muted mb-3">Riwayat</p>

        {isLoadingList ? (
          <p className="text-sm text-muted">Memuat…</p>
        ) : insights.length === 0 ? (
          <p className="text-sm text-muted text-center py-10 border-t border-line">
            Belum ada insight. Buat yang pertama di atas.
          </p>
        ) : (
          <div className="space-y-3">
            {insights.map((insight) => {
              const style = CATEGORY_STYLE[insight.category];
              return (
                <div
                  key={insight.id}
                  className={`bg-surface border border-line border-l-4 ${style.border} p-4`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-xs font-medium ${style.text}`}>
                      {style.label}
                    </span>
                    <span className="text-xs text-muted">
                      {new Date(insight.created_at).toLocaleDateString(
                        "id-ID",
                        {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )}
                    </span>
                  </div>
                  <p className="text-sm text-ink leading-relaxed">
                    {insight.insight_text}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
