"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useMealSchedule } from "@/context/MealScheduleContext";
import { api } from "@/lib/api";
import { HealthProfile, NutritionLog } from "@/lib/types";
import { getHealthProfile } from "@/lib/health-profile";
import { formatTime, type MealState } from "@/lib/meal-schedule";
import { Navbar } from "@/components/Navbar";
import { ProgressRing } from "@/components/ProgressRing";
import type { NewsArticle } from "../api/news/route";

const WATER_TARGET_ML = 2000;

const DAILY_TIPS = [
  "Mulai hari dengan segelas air putih — hidrasi membantu fokus dan metabolisme.",
  "Setengah piringmu diisi sayur & buah untuk asupan serat yang cukup.",
  "Jalan kaki 10 menit setelah makan membantu pencernaan lebih nyaman.",
  "Camilan malam? Pilih buah atau kacang-kacangan, bukan gorengan.",
  "Tidur 7–9 jam ternyata ikut menjaga berat badan ideal, lho!",
  "Makan pelan-pelan biar otak sempat memberi sinyal kenyang.",
];

export default function DashboardPage() {
  const { user, token, isLoading } = useAuth();
  const meal = useMealSchedule();
  const router = useRouter();

  const [log, setLog] = useState<NutritionLog | null>(null);
  const [profile, setProfile] = useState<HealthProfile | null>(null);

  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [isLoadingNews, setIsLoadingNews] = useState(true);
  const [newsError, setNewsError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) router.push("/login");
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!token) return;
    api
      .get<NutritionLog>("/v1/nutrition-logs", token)
      .then((logData) => {
        setLog(logData);
        // Makanan yang sudah tercatat otomatis mengonfirmasi waktu makan.
        meal.syncFromFoodItems(logData.food_items ?? []);
      })
      .catch(() => setLog(null));
    getHealthProfile(token)
      .then(setProfile)
      .catch(() => {});
  }, [token, meal.syncFromFoodItems]);

  useEffect(() => {
    fetch("/api/news")
      .then((res) => res.json())
      .then((data) => {
        if (data.error) setNewsError(data.error);
        else setArticles(data.articles ?? []);
      })
      .catch(() => setNewsError("Gagal memuat berita."))
      .finally(() => setIsLoadingNews(false));
  }, []);

  if (isLoading) {
    return (
      <main className="flex-1 flex items-center justify-center px-4">
        <p className="soft-chip">Menyiapkan dasbor sehat…</p>
      </main>
    );
  }

  const firstName = user?.name?.trim().split(/\s+/)[0] ?? "Sobat Sehat";
  const todayLabel = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const tipOfTheDay =
    DAILY_TIPS[new Date().getDate() % DAILY_TIPS.length] ?? DAILY_TIPS[0];

  const consumed = log?.total_calories ?? 0;
  const water = log?.water_intake_ml ?? 0;
  const target = profile?.calorie_target ?? null;
  const caloriePercent = target ? Math.min(1, consumed / target) : null;
  const waterPercent = Math.min(1, water / WATER_TARGET_ML);
  const foods = log?.food_items ?? [];

  return (
    <div className="flex-1 flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 pb-6">
        {/* Hero sapaan */}
        <section className="reveal-on-load pt-8 pb-6">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="soft-chip">
              <span aria-hidden>🌿</span> Hidup Sehat
            </span>
            <span className="text-xs text-muted">{todayLabel}</span>
          </div>
          <h1 className="section-title text-3xl sm:text-4xl mb-3 leading-[1.15]">
            Halo, {firstName} 👋
          </h1>
          <p className="text-base text-muted max-w-lg leading-relaxed">
            Foto makananmu, AI hitung kalorinya. Semua catatan sehatmu ada di
            satu tempat — semangat menjalani hari!
          </p>
          <div className="flex flex-wrap gap-3 mt-5">
            <Link
              href="/scan"
              className="rounded-2xl bg-gradient-to-r from-brand to-brand-dark text-white px-5 py-3 text-sm font-semibold shadow-[0_12px_26px_rgba(31,110,74,0.3)] hover:-translate-y-0.5 transition duration-200"
            >
              📷 Scan Makanan
            </Link>
            <Link
              href="/nutrition"
              className="rounded-2xl border border-line/80 bg-white/70 text-ink px-5 py-3 text-sm font-semibold hover:bg-white hover:-translate-y-0.5 transition duration-200"
            >
              📓 Catatan Harian
            </Link>
          </div>
        </section>
        {/* Ringkasan energi & hidrasi */}
        <section className="reveal-on-load grid sm:grid-cols-2 gap-4 mb-6">
          {/* Energi */}
          <div className="surface-card p-6 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <p className="section-title text-sm">Energi Hari Ini</p>
              <span className="text-lg" aria-hidden>
                ⚡
              </span>
            </div>

            {caloriePercent !== null ? (
              <ProgressRing
                progress={caloriePercent}
                color="var(--color-brand)"
              >
                <div className="text-center">
                  <p className="tabular font-display text-2xl font-bold text-ink">
                    {consumed.toLocaleString("id-ID")}
                  </p>
                  <p className="text-[10px] text-muted uppercase tracking-wide">
                    dari {target} kkal
                  </p>
                </div>
              </ProgressRing>
            ) : (
              <div className="text-center py-4">
                <div className="text-4xl mb-2" aria-hidden>
                  🎯
                </div>
                <p className="tabular font-display text-3xl font-bold text-ink mb-1">
                  {consumed.toLocaleString("id-ID")}
                  <span className="text-sm font-sans font-normal text-muted ml-1">
                    kkal
                  </span>
                </p>
                <p className="text-xs text-muted leading-5">
                  sudah masuk hari ini
                </p>
              </div>
            )}

            {/* Makro */}
            <div className="grid grid-cols-3 gap-2 mt-4">
              <MacroChip
                label="Karbo"
                value={Number(log?.carbs_g ?? 0).toFixed(0)}
                color="text-energy"
              />
              <MacroChip
                label="Protein"
                value={Number(log?.protein_g ?? 0).toFixed(0)}
                color="text-hydration"
              />
              <MacroChip
                label="Lemak"
                value={Number(log?.fat_g ?? 0).toFixed(0)}
                color="text-warn"
              />
            </div>

            {caloriePercent === null && (
              <Link
                href="/profile"
                className="mt-4 rounded-2xl bg-brand/10 text-brand text-center px-4 py-2.5 text-xs font-semibold hover:bg-brand/15 transition"
              >
                Lengkapi profil untuk target kalori personal →
              </Link>
            )}
          </div>

          {/* Hidrasi */}
          <div className="surface-card p-6 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <p className="section-title text-sm">Hidrasi</p>
              <span className="text-lg" aria-hidden>
                💧
              </span>
            </div>
            <div className="flex-1 flex items-center justify-center">
              <ProgressRing
                progress={waterPercent}
                color="var(--color-hydration)"
              >
                <div className="text-center">
                  <p className="tabular font-display text-2xl font-bold text-hydration">
                    {water.toLocaleString("id-ID")}
                  </p>
                  <p className="text-[10px] text-muted uppercase tracking-wide">
                    ml air
                  </p>
                </div>
              </ProgressRing>
            </div>
            <p className="text-xs text-muted mt-4 text-center leading-5">
              Target {WATER_TARGET_ML.toLocaleString("id-ID")} ml per hari. Yuk
              tambah lewat Catatan Harian!
            </p>
            <Link
              href="/nutrition"
              className="mt-3 rounded-2xl bg-hydration-soft text-hydration text-center px-4 py-2.5 text-xs font-semibold hover:bg-hydration/10 transition"
            >
              Tambah air minum →
            </Link>
          </div>
        </section>

        {/* Aksi cepat */}
        <section className="reveal-on-load grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
          <QuickAction
            href="/scan"
            gradient="from-energy to-energy/90"
            icon="🍽️"
            title="Scan Makanan"
            subtitle="Foto & AI hitung kalori"
            cta="Scan foto"
          />
          <QuickAction
            href="/nutrition"
            gradient="from-hydration to-hydration/85"
            icon="📓"
            title="Catatan Harian"
            subtitle="Kalori, makro & air hari ini"
            cta="Buka catatan"
          />
          <QuickAction
            href="/jadwal-makan"
            gradient="from-brand to-brand-dark"
            icon="⏰"
            title="Atur Jam Makan"
            subtitle="Pengingat makan pagi, siang & sore"
            cta="Kelola jadwal"
          />
          <QuickAction
            href="/riwayat-kesehatan"
            gradient="from-brand/90 to-hydration"
            icon="📈"
            title="Riwayat Kesehatan"
            subtitle="Lihat tren kalori & hidrasi"
            cta="Buka riwayat"
          />
        </section>

        {/* Jam makan hari ini */}
        <section className="reveal-on-load surface-card p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="section-title text-sm">Jam Makan Hari Ini</p>
            <Link
              href="/jadwal-makan"
              className="text-xs text-brand font-semibold hover:underline"
            >
              Atur jam makan →
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {meal.states.map((state) => (
              <MealChip key={state.id} state={state} />
            ))}
          </div>
          <p className="mt-3 text-xs text-muted leading-5">
            Status otomatis — waktu makan terkonfirmasi saat kamu scan fotonya
            di <span className="font-medium text-ink">Scan Makanan</span>.
          </p>
          {meal.states.some((s) => s.condition === "due") && (
            <p className="mt-2 text-xs text-brand font-medium leading-5">
              🔔 Ada waktu makan yang sudah waktunya — scan foto makananku untuk
              mengonfirmasinya!
            </p>
          )}
          {meal.states.some((s) => s.condition === "late") && (
            <p className="mt-2 text-xs text-energy font-medium leading-5">
              ⚠️ Ada waktu makan yang kamu lewatkan hari ini. Jangan lewatkan
              yang berikutnya, ya!
            </p>
          )}
        </section>

        {/* Makanan tercatat hari ini */}
        <section className="reveal-on-load surface-card overflow-hidden mb-6">
          <div className="px-5 pt-5 pb-3 flex items-center justify-between">
            <p className="section-title text-sm">Makanan Hari Ini</p>
            <Link
              href="/nutrition"
              className="text-xs text-brand font-semibold hover:underline"
            >
              Lihat semua →
            </Link>
          </div>
          {foods.length === 0 ? (
            <div className="text-center py-8 px-4">
              <div className="text-3xl mb-2" aria-hidden>
                🥗
              </div>
              <p className="text-sm text-muted">
                Belum ada makanan tercatat hari ini.
              </p>
              <Link
                href="/scan"
                className="mt-3 inline-block rounded-2xl bg-brand text-white px-5 py-2.5 text-sm font-semibold hover:bg-brand-dark transition"
              >
                Scan sekarang
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-line/70">
              {foods.slice(0, 4).map((item) => (
                <li key={item.id} className="flex items-center gap-3 px-5 py-3">
                  {item.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.image_url}
                      alt={item.food_name}
                      className="w-11 h-11 object-cover rounded-xl shrink-0"
                    />
                  ) : (
                    <span className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand/10 via-paper to-energy/10 shrink-0 flex items-center justify-center text-lg">
                      🍴
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink truncate">
                      {item.food_name}
                    </p>
                    <p className="text-xs text-muted">
                      {item.source_type === "SCAN" ? "Scan AI" : "Manual"}
                    </p>
                  </div>
                  <p className="tabular font-display text-sm font-semibold text-energy">
                    {item.calories}
                    <span className="text-[10px] font-sans font-normal text-muted ml-0.5">
                      kkal
                    </span>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Tips hari ini */}
        <section className="reveal-on-load surface-card p-6 mb-6 flex items-start gap-4">
          <span className="text-3xl shrink-0" aria-hidden>
            💡
          </span>
          <div>
            <p className="section-title text-sm mb-1.5">Tips Sehat Hari Ini</p>
            <p className="text-sm text-muted leading-6">{tipOfTheDay}</p>
          </div>
        </section>

        {/* Berita & tips hidup sehat */}
        <section className="reveal-on-load mb-6">
          <div className="flex items-baseline justify-between mb-4">
            <p className="section-title text-sm">
              Berita &amp; Tips Hidup Sehat
            </p>
            <span className="text-xs text-muted">Diperbarui tiap hari</span>
          </div>

          {isLoadingNews ? (
            <p className="text-sm text-muted py-6">Memuat berita…</p>
          ) : newsError ? (
            <p className="text-sm text-muted py-6">
              Berita belum bisa ditampilkan saat ini.
            </p>
          ) : articles.length === 0 ? (
            <p className="text-sm text-muted py-6">Belum ada berita terbaru.</p>
          ) : (
            <div className="space-y-4">
              {articles.map((article) => (
                <NewsCard key={article.url} article={article} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function MacroChip({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-line/70 bg-paper/60 px-2 py-2.5 text-center">
      <p className={`tabular font-display text-base font-bold ${color}`}>
        {value}g
      </p>
      <p className="text-[10px] text-muted uppercase tracking-wide">{label}</p>
    </div>
  );
}
const MEAL_SHORT_LABEL: Record<string, string> = {
  pagi: "Pagi",
  siang: "Siang",
  sore: "Sore",
};

function MealChip({ state }: { state: MealState }) {
  let statusText: string;
  let statusClass: string;

  if (state.eaten) {
    statusText = state.onTime ? "Tepat waktu ✓" : "Terlambat";
    statusClass = state.onTime ? "text-brand" : "text-warn";
  } else if (state.condition === "due") {
    statusText = "Waktunya makan!";
    statusClass = "text-brand";
  } else if (state.condition === "late") {
    statusText = "Telat makan!";
    statusClass = "text-energy";
  } else if (state.condition === "near") {
    statusText = "Segera";
    statusClass = "text-hydration";
  } else {
    statusText = "Menunggu";
    statusClass = "text-muted";
  }

  return (
    <div className="rounded-2xl border border-line/70 bg-paper/60 px-2 py-2.5 text-center">
      <p className="text-xl" aria-hidden>
        {state.emoji}
      </p>
      <p className="text-[10px] text-muted uppercase tracking-wide mt-1">
        {MEAL_SHORT_LABEL[state.id] ?? state.label}
      </p>
      <p className="tabular font-display text-sm font-bold text-ink">
        {formatTime(state.time)}
      </p>
      <p className={`text-[10px] font-semibold mt-0.5 ${statusClass}`}>
        {statusText}
      </p>
    </div>
  );
}

function QuickAction({
  href,
  gradient,
  icon,
  title,
  subtitle,
  cta = "Buka",
}: {
  href: string;
  gradient: string;
  icon: string;
  title: string;
  subtitle: string;
  cta?: string;
}) {
  return (
    <Link
      href={href}
      className={`rounded-3xl bg-gradient-to-br ${gradient} p-5 text-white shadow-lg hover:-translate-y-1 transition duration-200`}
    >
      <span className="text-2xl block mb-2" aria-hidden>
        {icon}
      </span>
      <p className="font-display font-semibold text-sm sm:text-base">{title}</p>
      <p className="text-xs sm:text-[13px] text-white/85 mt-0.5 leading-5">
        {subtitle}
      </p>
      <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold bg-white/20 rounded-full px-3 py-1">
        {cta} <span aria-hidden>→</span>
      </span>
    </Link>
  );
}

function NewsCard({ article }: { article: NewsArticle }) {
  return (
    <article className="surface-card overflow-hidden">
      <div className="p-4 flex flex-col sm:flex-row gap-3 sm:items-start">
        {article.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={article.imageUrl}
            alt=""
            className="w-full sm:w-24 h-32 sm:h-20 object-cover rounded-2xl shrink-0"
          />
        ) : (
          <span className="hidden sm:flex w-24 h-20 rounded-2xl bg-gradient-to-br from-brand/10 to-energy/10 items-center justify-center text-2xl shrink-0">
            🥗
          </span>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-muted mb-1.5">
            <span className="soft-chip">{article.source}</span>
            <span>
              {new Date(article.publishedAt).toLocaleDateString("id-ID", {
                day: "numeric",
                month: "short",
              })}
            </span>
          </div>
          <p className="text-sm font-medium text-ink leading-snug">
            {article.title}
          </p>
          {article.description && (
            <p className="text-xs text-muted leading-5 mt-1.5 line-clamp-2">
              {article.description}
            </p>
          )}
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-xs text-brand font-medium mt-2 hover:underline"
          >
            Baca artikel lengkap →
          </a>
        </div>
      </div>
    </article>
  );
}
