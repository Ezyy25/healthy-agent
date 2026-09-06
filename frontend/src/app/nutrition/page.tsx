"use client";

import { useEffect, useState, FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useMealSchedule } from "@/context/MealScheduleContext";
import { api, ApiError } from "@/lib/api";
import {
  NutritionLog,
  HealthProfile,
  FoodItem,
  FoodMicronutrients,
  MineralEntry,
  MineralType,
} from "@/lib/types";
import { getHealthProfile, getHydrationTargetMl } from "@/lib/health-profile";
import { Navbar } from "@/components/Navbar";
import { ProgressRing } from "@/components/ProgressRing";

const QUICK_WATER_AMOUNTS = [100, 250, 500];
const MINERAL_OPTIONS: Array<{
  key: keyof FoodMicronutrients;
  type: MineralType;
  label: string;
  color: string;
  target: number;
}> = [
  {
    key: "natrium_mg",
    type: "natrium",
    label: "Natrium (Na)",
    color: "bg-energy",
    target: 2300,
  },
  {
    key: "kalium_mg",
    type: "kalium",
    label: "Kalium (K)",
    color: "bg-hydration",
    target: 3500,
  },
  {
    key: "magnesium_mg",
    type: "magnesium",
    label: "Magnesium (Mg)",
    color: "bg-brand",
    target: 320,
  },
];

function loadMineralEntries(
  userId: number | string | undefined,
): MineralEntry[] {
  if (!userId || typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`healthy_agent_mineral_entries_${userId}`);
    const parsed = raw ? (JSON.parse(raw) as MineralEntry[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function NutritionPage() {
  const { user, token, isLoading } = useAuth();
  const meal = useMealSchedule();
  const router = useRouter();

  const [log, setLog] = useState<NutritionLog | null>(null);
  const [profile, setProfile] = useState<HealthProfile | null>(null);
  const [isLoadingLog, setIsLoadingLog] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddingWater, setIsAddingWater] = useState(false);
  const [customAmount, setCustomAmount] = useState("");
  const [mineralEntries, setMineralEntries] = useState<MineralEntry[]>([]);

  useEffect(() => {
    if (!isLoading && !user) router.push("/login");
  }, [isLoading, user, router]);

  // Data catatan + profil (untuk target kalori) diambil bersamaan, paralel.
  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const data = await api.get<NutritionLog>("/v1/nutrition-logs", token);
        setLog(data);
        // Makanan yang sudah tercatat otomatis mengonfirmasi waktu makan.
        meal.syncFromFoodItems(data.food_items ?? []);
      } catch {
        setError("Gagal memuat data hari ini.");
      } finally {
        setIsLoadingLog(false);
      }
    })();
    getHealthProfile(token)
      .then(setProfile)
      .catch(() => {});
  }, [token, meal.syncFromFoodItems]);

  useEffect(() => {
    setMineralEntries(loadMineralEntries(user?.id));
  }, [user?.id]);

  async function addWater(amountMl: number) {
    if (!token || amountMl <= 0) return;
    setError(null);
    setIsAddingWater(true);

    try {
      const updated = await api.post<NutritionLog>(
        "/v1/nutrition-logs/water",
        { amount_ml: amountMl },
        token,
      );
      setLog((prev) => ({ ...updated, food_items: prev?.food_items ?? [] }));
      setCustomAmount("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal menambah air.");
    } finally {
      setIsAddingWater(false);
    }
  }

  function handleCustomSubmit(e: FormEvent) {
    e.preventDefault();
    const amount = Number(customAmount);
    if (amount > 0) addWater(amount);
  }

  if (isLoading || !user) {
    return (
      <main className="flex-1 flex items-center justify-center px-4">
        <p className="soft-chip">Memuat catatan sehat…</p>
      </main>
    );
  }

  const consumed = log?.total_calories ?? 0;
  const water = log?.water_intake_ml ?? 0;
  const target = profile?.calorie_target ?? null;
  const hydrationTargetMl = getHydrationTargetMl(profile);
  const caloriePercent = target ? Math.min(1, consumed / target) : null;
  const waterPercent = Math.min(1, water / hydrationTargetMl);
  const foods = log?.food_items ?? [];
  const scanMineralIds = new Set(mineralEntries.map((entry) => entry.id));
  const mineralTotals = MINERAL_OPTIONS.reduce(
    (acc, option) => {
      const storedTotal = mineralEntries
        .filter((entry) => entry.type === option.type)
        .reduce((sum, entry) => sum + entry.amount_mg, 0);
      const apiTotal = foods.reduce((sum, food) => {
        const scanEntryId = `scan-${food.id}-${option.type}`;
        if (scanMineralIds.has(scanEntryId)) return sum;
        return sum + Number(food.micronutrients?.[option.key] ?? 0);
      }, 0);
      acc[option.key] = storedTotal + apiTotal;
      return acc;
    },
    {} as Record<keyof FoodMicronutrients, number>,
  );

  const macros = [
    {
      label: "Karbohidrat",
      grams: Number(log?.carbs_g ?? 0),
      bar: "bg-energy",
      text: "text-energy",
    },
    {
      label: "Protein",
      grams: Number(log?.protein_g ?? 0),
      bar: "bg-hydration",
      text: "text-hydration",
    },
    {
      label: "Lemak",
      grams: Number(log?.fat_g ?? 0),
      bar: "bg-warn",
      text: "text-warn",
    },
  ];

  return (
    <>
      <Navbar />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 pt-6 pb-12">
        {/* Header */}
        <section className="surface-card p-6 mb-5">
          <span className="soft-chip inline-flex">📓 Catatan Harian</span>
          <h1 className="section-title text-2xl sm:text-3xl mt-3">
            Catatan Hari Ini
          </h1>
          <p className="text-sm text-muted mt-2">
            {new Date().toLocaleDateString("id-ID", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </section>

        {error && (
          <p className="text-sm text-energy bg-energy-soft/80 px-4 py-3 mb-4 rounded-2xl">
            {error}
          </p>
        )}

        {isLoadingLog ? (
          <p className="text-sm text-muted">Memuat…</p>
        ) : log ? (
          <div className="space-y-5">
            {/* Ringkasan kalori & air */}
            <section className="grid sm:grid-cols-2 gap-4">
              <SummaryCard
                title="Kalori"
                emoji="⚡"
                percent={caloriePercent}
                color="var(--color-brand)"
                centerText={
                  <>
                    <p className="tabular font-display text-2xl font-bold">
                      {consumed.toLocaleString("id-ID")}
                    </p>
                    <p className="text-[10px] text-muted uppercase tracking-wide">
                      {target ? `dari ${target} kkal` : "kkal masuk"}
                    </p>
                  </>
                }
              >
                {!target && (
                  <Link
                    href="/profile"
                    className="mt-4 inline-block rounded-2xl bg-brand/10 text-brand px-4 py-2.5 text-xs font-semibold hover:bg-brand/15 transition"
                  >
                    Isi profil untuk target kalori →
                  </Link>
                )}
                <div className="w-full mt-4 pt-4 border-t border-line/60 space-y-3 text-left">
                  <p className="text-[11px] text-muted uppercase tracking-wide">
                    Makro hari ini
                  </p>
                  {macros.map((macro) => (
                    <MacroBar key={macro.label} {...macro} />
                  ))}
                </div>
              </SummaryCard>

              <SummaryCard
                title="Air Minum"
                emoji="💧"
                percent={waterPercent}
                color="var(--color-hydration)"
                centerText={
                  <>
                    <p className="tabular font-display text-2xl font-bold text-hydration">
                      {water.toLocaleString("id-ID")}
                    </p>
                    <p className="text-[10px] text-muted uppercase tracking-wide">
                      ml dari {hydrationTargetMl.toLocaleString("id-ID")}
                    </p>
                  </>
                }
              >
                <p className="text-[11px] text-hydration mt-2 font-medium">
                  Target hidrasi: {hydrationTargetMl.toLocaleString("id-ID")}{" "}
                  ml/hari
                  {profile
                    ? ` • ${profile.weight_kg} kg • ${profile.activity_level}`
                    : ""}
                </p>
                <div className="flex gap-2 mt-4">
                  {QUICK_WATER_AMOUNTS.map((amount) => (
                    <button
                      key={amount}
                      onClick={() => addWater(amount)}
                      disabled={isAddingWater}
                      className="flex-1 rounded-2xl border border-hydration/30 bg-hydration-soft text-hydration py-2 text-xs font-semibold hover:bg-hydration/10 disabled:opacity-50 transition"
                    >
                      +{amount}ml
                    </button>
                  ))}
                </div>
              </SummaryCard>
            </section>

            <section className="surface-card p-4">
              <div className="flex items-center justify-between gap-3 mb-2">
                <p className="section-title text-sm">Mineral Spesifik</p>
                <span className="soft-chip">Otomatis dari hasil scan</span>
              </div>
              <p className="text-xs text-muted leading-5 mb-4">
                Nilai dihitung dari estimasi mikro-nutrisi yang dikirim AI untuk
                setiap makanan yang berhasil di-scan.
              </p>

              <div className="grid gap-3 sm:grid-cols-3">
                {MINERAL_OPTIONS.map((option) => {
                  const amount = mineralTotals[option.key];
                  const progress = Math.min(
                    100,
                    (amount / option.target) * 100,
                  );
                  return (
                    <div
                      key={option.key}
                      className="rounded-2xl border border-line/70 bg-paper/60 p-3"
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span
                          className={`inline-flex h-2.5 w-2.5 rounded-full ${option.color}`}
                        />
                        <span className="text-[11px] text-muted uppercase tracking-wide">
                          {option.label}
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="tabular font-display text-xl font-bold text-ink">
                          {Math.round(amount).toLocaleString("id-ID")}
                        </p>
                        <p className="text-[10px] text-muted">
                          / {option.target.toLocaleString("id-ID")} mg
                        </p>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-paper overflow-hidden">
                        <div
                          className={`h-full rounded-full ${option.color} transition-all duration-700`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-muted mt-1">
                        mg dari scan hari ini
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>
            {/* Air custom */}
            <section>
              <form onSubmit={handleCustomSubmit} className="surface-card p-4">
                <p className="section-title text-sm mb-3">Tambah Air</p>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={1}
                    placeholder="ml"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    className="field-input flex-1 min-w-0"
                  />
                  <button
                    type="submit"
                    disabled={isAddingWater || !customAmount}
                    className="rounded-2xl bg-hydration text-white px-3 text-xs font-semibold hover:bg-hydration/85 disabled:opacity-50 transition"
                  >
                    Tambah
                  </button>
                </div>
              </form>
            </section>
            {/* Daftar makanan */}
            <section className="surface-card overflow-hidden">
              <div className="px-5 pt-5 pb-3 flex items-center justify-between">
                <p className="section-title text-sm">
                  Makanan Tercatat ({foods.length})
                </p>
                <Link
                  href="/scan"
                  className="rounded-2xl bg-brand text-white px-4 py-2 text-xs font-semibold shadow-[0_8px_18px_rgba(31,110,74,0.25)] hover:bg-brand-dark transition"
                >
                  + Scan foto
                </Link>
              </div>

              {foods.length === 0 ? (
                <div className="text-center py-10 px-4">
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
                  {foods.map((item) => (
                    <li
                      key={item.id}
                      className="py-3 px-5 flex items-center gap-3"
                    >
                      {item.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.image_url}
                          alt={item.food_name}
                          className="w-12 h-12 object-cover rounded-xl shrink-0"
                        />
                      ) : (
                        <span className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand/10 to-energy/10 shrink-0 flex items-center justify-center text-lg">
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
                        <FoodMinerals item={item} />
                      </div>
                      <MacroMini item={item} />
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
          </div>
        ) : (
          <p className="text-sm text-muted">Gagal memuat data.</p>
        )}
      </main>
    </>
  );
}
/**
 * Kartu ringkasan dengan donut chart (progress 0..1) dan area konten bebas
 * di bawahnya, dipakai untuk Kalori & Air.
 */
function SummaryCard({
  title,
  emoji,
  percent,
  color,
  centerText,
  children,
}: {
  title: string;
  emoji: string;
  percent: number | null;
  color: string;
  centerText: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="surface-card p-5 flex flex-col items-center text-center">
      <div className="flex items-center justify-between w-full mb-4">
        <p className="section-title text-sm">{title}</p>
        <span className="text-lg" aria-hidden>
          {emoji}
        </span>
      </div>

      <ProgressRing progress={percent ?? 0} color={color}>
        {centerText}
      </ProgressRing>

      {children && <div className="w-full">{children}</div>}
    </div>
  );
}

function MacroBar({
  label,
  grams,
  bar,
  text,
}: {
  label: string;
  grams: number;
  bar: string;
  text: string;
}) {
  // Batasi visual 0–100g supaya bar tetap proporsional & informatif.
  const width = Math.min(100, grams);
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-muted">{label}</span>
        <span className={`tabular font-medium ${text}`}>
          {grams.toFixed(0)}g
        </span>
      </div>
      <div className="h-2 rounded-full bg-paper border border-line/60 overflow-hidden">
        <div
          className={`h-full rounded-full ${bar} transition-all duration-700`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function MacroMini({ item }: { item: FoodItem }) {
  return (
    <div className="hidden sm:flex items-center gap-2 text-[11px] text-muted">
      <span>K {Number(item.carbs_g).toFixed(0)}</span>
      <span>P {Number(item.protein_g).toFixed(0)}</span>
      <span>L {Number(item.fat_g).toFixed(0)}</span>
    </div>
  );
}

function FoodMinerals({ item }: { item: FoodItem }) {
  const minerals = MINERAL_OPTIONS.map((option) => ({
    label: option.label.split(" ")[0],
    amount: Number(item.micronutrients?.[option.key] ?? 0),
  })).filter((mineral) => mineral.amount > 0);

  if (minerals.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1 text-[10px] text-hydration">
      {minerals.map((mineral) => (
        <span key={mineral.label}>
          {mineral.label} {Math.round(mineral.amount)} mg
        </span>
      ))}
    </div>
  );
}
