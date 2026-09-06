"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { getHealthProfile, getHydrationTargetMl } from "@/lib/health-profile";
import type {
  FoodMicronutrients,
  HealthProfile,
  MineralEntry,
  NutritionLog,
} from "@/lib/types";
import { Navbar } from "@/components/Navbar";

type Period = 7 | 30 | 90;
type MineralKey = keyof FoodMicronutrients;

interface HealthSnapshot {
  date: string;
  calories: number;
  water: number;
  weight: number;
  natrium: number;
  kalium: number;
  magnesium: number;
}

const SNAPSHOT_PREFIX = "healthy_agent_health_history_";
const MINERALS: Array<{
  key: MineralKey;
  label: string;
  shortLabel: string;
  target: number;
  color: string;
  bar: string;
}> = [
  {
    key: "natrium_mg",
    label: "Natrium",
    shortLabel: "Na",
    target: 2300,
    color: "text-energy",
    bar: "bg-energy",
  },
  {
    key: "kalium_mg",
    label: "Kalium",
    shortLabel: "K",
    target: 3500,
    color: "text-hydration",
    bar: "bg-hydration",
  },
  {
    key: "magnesium_mg",
    label: "Magnesium",
    shortLabel: "Mg",
    target: 320,
    color: "text-brand",
    bar: "bg-brand",
  },
];

function dateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function loadSnapshots(userId: number) {
  try {
    const raw = localStorage.getItem(`${SNAPSHOT_PREFIX}${userId}`);
    const parsed = raw ? (JSON.parse(raw) as HealthSnapshot[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSnapshot(userId: number, snapshot: HealthSnapshot) {
  const snapshots = loadSnapshots(userId).filter(
    (item) => item.date !== snapshot.date,
  );
  localStorage.setItem(
    `${SNAPSHOT_PREFIX}${userId}`,
    JSON.stringify([snapshot, ...snapshots].slice(0, 180)),
  );
}

function loadMinerals(userId: number) {
  try {
    const raw = localStorage.getItem(`healthy_agent_mineral_entries_${userId}`);
    const parsed = raw ? (JSON.parse(raw) as MineralEntry[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getMineralTotals(userId: number, log: NutritionLog) {
  const entries = loadMinerals(userId);
  return MINERALS.reduce(
    (totals, mineral) => {
      const localTotal = entries
        .filter((entry) => entry.type === mineral.label.toLowerCase())
        .filter((entry) => !entry.id.startsWith("scan-"))
        .reduce((sum, entry) => sum + entry.amount_mg, 0);
      const scanTotal = (log.food_items ?? []).reduce(
        (sum, food) => sum + Number(food.micronutrients?.[mineral.key] ?? 0),
        0,
      );
      totals[mineral.shortLabel] = localTotal + scanTotal;
      return totals;
    },
    {} as Record<string, number>,
  );
}

function formatDay(date: string, options: Intl.DateTimeFormatOptions) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("id-ID", options);
}

export default function HealthHistoryPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const [period, setPeriod] = useState<Period>(7);
  const [snapshots, setSnapshots] = useState<HealthSnapshot[]>([]);
  const [profile, setProfile] = useState<HealthProfile | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);

  useEffect(() => {
    if (!isLoading && !user) router.push("/login");
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!token || !user) return;
    let active = true;
    Promise.all([
      api.get<NutritionLog>("/v1/nutrition-logs", token),
      getHealthProfile(token).catch(() => null),
    ])
      .then(([log, healthProfile]) => {
        if (!active) return;
        setProfile(healthProfile);
        const totals = getMineralTotals(user.id, log);
        saveSnapshot(user.id, {
          date: log.date || dateKey(),
          calories: Number(log.total_calories ?? 0),
          water: Number(log.water_intake_ml ?? 0),
          weight: Number(healthProfile?.weight_kg ?? 0),
          natrium: totals.Na ?? 0,
          kalium: totals.K ?? 0,
          magnesium: totals.Mg ?? 0,
        });
        setSnapshots(loadSnapshots(user.id));
      })
      .catch(() => {
        if (active) setSnapshots(loadSnapshots(user.id));
      })
      .finally(() => {
        if (active) setIsLoadingData(false);
      });
    return () => {
      active = false;
    };
  }, [token, user]);

  const visibleSnapshots = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - period + 1);
    return snapshots
      .filter((snapshot) => new Date(`${snapshot.date}T12:00:00`) >= cutoff)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [snapshots, period]);

  const targetCalories = profile?.calorie_target ?? profile?.tdee ?? 2000;
  const hydrationTarget = getHydrationTargetMl(profile);
  const averageCalories = average(
    visibleSnapshots.map((item) => item.calories),
  );
  const averageWater = average(visibleSnapshots.map((item) => item.water));
  const latestWeight = [...visibleSnapshots]
    .reverse()
    .find((item) => item.weight > 0)?.weight;
  const calorieScore = visibleSnapshots.length
    ? Math.round(
        (visibleSnapshots.filter(
          (item) => item.calories <= targetCalories * 1.1,
        ).length /
          visibleSnapshots.length) *
          100,
      )
    : 0;

  if (isLoading || !user) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p className="soft-chip">Menyiapkan riwayat kesehatan…</p>
      </main>
    );
  }

  return (
    <>
      <Navbar />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 pt-7 pb-12">
        <section className="reveal-on-load flex flex-col sm:flex-row sm:items-end justify-between gap-5 mb-7">
          <div>
            <span className="soft-chip">◷ Perjalanan kesehatan</span>
            <h1 className="section-title text-3xl sm:text-4xl mt-3">
              Riwayat Kesehatan
            </h1>
            <p className="text-sm text-muted mt-2 max-w-xl leading-6">
              Lihat pola energi, hidrasi, dan mineralmu dari waktu ke waktu.
              Data bertambah setiap kali catatan harian dibuka.
            </p>
          </div>
          <div className="flex rounded-2xl border border-line bg-surface/80 p-1 self-start sm:self-auto">
            {[7, 30, 90].map((value) => (
              <button
                key={value}
                onClick={() => setPeriod(value as Period)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold transition ${period === value ? "bg-brand text-white shadow-sm" : "text-muted hover:text-ink"}`}
              >
                {value} hari
              </button>
            ))}
          </div>
        </section>

        {isLoadingData ? (
          <p className="text-sm text-muted">Memuat data riwayat…</p>
        ) : (
          <>
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
              <MetricCard
                label="Rata-rata kalori"
                value={
                  averageCalories
                    ? `${Math.round(averageCalories).toLocaleString("id-ID")} kkal`
                    : "Belum ada"
                }
                note={`Target ${Math.round(targetCalories).toLocaleString("id-ID")} kkal`}
                color="text-energy"
              />
              <MetricCard
                label="Capaian hidrasi"
                value={
                  averageWater
                    ? `${Math.round(averageWater).toLocaleString("id-ID")} ml`
                    : "Belum ada"
                }
                note={`Target ${hydrationTarget.toLocaleString("id-ID")} ml`}
                color="text-hydration"
              />
              <MetricCard
                label="Berat terakhir"
                value={latestWeight ? `${latestWeight} kg` : "Belum ada"}
                note="Dari profil kesehatan"
                color="text-brand"
              />
              <MetricCard
                label="Hari sesuai target"
                value={
                  visibleSnapshots.length ? `${calorieScore}%` : "Belum ada"
                }
                note={`${visibleSnapshots.length} hari tercatat`}
                color="text-warn"
              />
            </section>

            <section className="surface-card p-5 sm:p-6 mb-5">
              <ChartHeading
                title="Keseimbangan Kalori"
                caption={`Asupan harian dibanding target ${Math.round(targetCalories).toLocaleString("id-ID")} kkal`}
              />
              <BarChart data={visibleSnapshots} target={targetCalories} />
              <div className="flex flex-wrap gap-4 mt-4 text-[11px] text-muted">
                <Legend color="bg-brand" label="Dalam batas target" />
                <Legend color="bg-energy" label="Melewati target" />
                <Legend color="bg-line" label="Target TDEE" />
              </div>
            </section>

            <section className="grid lg:grid-cols-[1.15fr_0.85fr] gap-5">
              <div className="surface-card p-5 sm:p-6">
                <ChartHeading
                  title="Berat vs asupan"
                  caption="Korelasi sederhana dari catatan yang tersedia"
                />
                <TrendChart data={visibleSnapshots} target={targetCalories} />
                <div className="flex gap-4 mt-3 text-[11px] text-muted">
                  <Legend color="bg-brand" label="Berat (kg)" />
                  <Legend color="bg-energy" label="Kalori (relatif)" />
                </div>
                <p className="text-[11px] text-muted mt-3 leading-5">
                  Berat dicatat dari profil saat snapshot dibuat. Tambahkan
                  pembaruan profil berkala agar trennya lebih bermakna.
                </p>
              </div>
              <div className="surface-card p-5 sm:p-6">
                <ChartHeading
                  title="Hidrasi & mineral"
                  caption="Rata-rata harian pada periode ini"
                />
                <HydrationChart
                  data={visibleSnapshots}
                  target={hydrationTarget}
                />
                <div className="space-y-3 mt-5">
                  {MINERALS.map((mineral) => {
                    const amount = average(
                      visibleSnapshots.map(
                        (item) =>
                          item[
                            mineral.shortLabel.toLowerCase() as
                              | "natrium"
                              | "kalium"
                              | "magnesium"
                          ],
                      ),
                    );
                    const progress = Math.min(
                      100,
                      (amount / mineral.target) * 100,
                    );
                    return (
                      <div key={mineral.key}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted">{mineral.label}</span>
                          <span
                            className={`tabular font-semibold ${mineral.color}`}
                          >
                            {Math.round(amount).toLocaleString("id-ID")} /{" "}
                            {mineral.target.toLocaleString("id-ID")} mg
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-paper overflow-hidden">
                          <div
                            className={`h-full rounded-full ${mineral.bar}`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            {visibleSnapshots.length < Math.min(period, 3) && (
              <div className="mt-5 rounded-2xl border border-brand/20 bg-brand/5 px-4 py-3 text-xs text-brand leading-5">
                Riwayatmu baru mulai terbentuk. Buka Catatan Harian setiap hari
                untuk melihat grafik yang lebih lengkap.
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}

function average(values: number[]) {
  const valid = values.filter((value) => Number.isFinite(value) && value > 0);
  return valid.length
    ? valid.reduce((sum, value) => sum + value, 0) / valid.length
    : 0;
}

function MetricCard({
  label,
  value,
  note,
  color,
}: {
  label: string;
  value: string;
  note: string;
  color: string;
}) {
  return (
    <div className="surface-card p-4">
      <p className="text-[11px] text-muted uppercase tracking-wide">{label}</p>
      <p className={`font-display text-xl font-bold mt-2 ${color}`}>{value}</p>
      <p className="text-[11px] text-muted mt-1">{note}</p>
    </div>
  );
}

function ChartHeading({ title, caption }: { title: string; caption: string }) {
  return (
    <div className="flex items-start justify-between gap-3 mb-5">
      <div>
        <h2 className="section-title text-base">{title}</h2>
        <p className="text-xs text-muted mt-1">{caption}</p>
      </div>
      <span className="text-xs text-muted">
        {new Date().toLocaleDateString("id-ID", {
          month: "short",
          year: "numeric",
        })}
      </span>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <i className={`w-2 h-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}

function BarChart({
  data,
  target,
}: {
  data: HealthSnapshot[];
  target: number;
}) {
  const chart = data.length
    ? data
    : [
        {
          date: dateKey(),
          calories: 0,
          water: 0,
          weight: 0,
          natrium: 0,
          kalium: 0,
          magnesium: 0,
        },
      ];
  const max = Math.max(target * 1.2, ...chart.map((item) => item.calories), 1);
  return (
    <div className="h-52 flex items-end gap-2 sm:gap-4 border-b border-line/70 pt-5">
      {chart.map((item) => {
        const height = item.calories
          ? Math.max(7, (item.calories / max) * 100)
          : 3;
        return (
          <div
            key={item.date}
            className="flex-1 h-full flex flex-col justify-end items-center gap-2 min-w-0"
          >
            <div
              className="w-full max-w-12 rounded-t-lg bg-line/40 relative"
              style={{ height: `${height}%` }}
            >
              <div
                className={`absolute inset-0 rounded-t-lg ${item.calories > target * 1.1 ? "bg-energy" : "bg-brand"}`}
              />
            </div>
            <span className="text-[10px] text-muted truncate max-w-full">
              {formatDay(item.date, { day: "numeric", month: "short" })}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function TrendChart({
  data,
  target,
}: {
  data: HealthSnapshot[];
  target: number;
}) {
  if (data.length < 2)
    return (
      <EmptyChart text="Dua snapshot diperlukan untuk membaca korelasi." />
    );
  const weights = data.map((item) => item.weight).filter(Boolean);
  const minWeight = Math.min(...weights) - 1;
  const maxWeight = Math.max(...weights) + 1;
  const maxCalories = Math.max(...data.map((item) => item.calories), target, 1);
  const caloriePoints = data
    .map(
      (item, index) =>
        `${(index / Math.max(data.length - 1, 1)) * 100},${100 - (item.calories / maxCalories) * 100}`,
    )
    .join(" ");
  const points = data
    .map(
      (item, index) =>
        `${(index / Math.max(data.length - 1, 1)) * 100},${100 - ((item.weight - minWeight) / (maxWeight - minWeight)) * 100}`,
    )
    .join(" ");
  return (
    <div className="relative h-40 border-b border-l border-line/70">
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full overflow-visible"
      >
        <polyline
          points={points}
          fill="none"
          stroke="var(--color-brand)"
          strokeWidth="1.8"
          vectorEffect="non-scaling-stroke"
        />
        <polyline
          points={caloriePoints}
          fill="none"
          stroke="var(--color-energy)"
          strokeWidth="1.5"
          strokeDasharray="4 3"
          vectorEffect="non-scaling-stroke"
        />
        {data.map((item, index) => (
          <circle
            key={item.date}
            cx={(index / Math.max(data.length - 1, 1)) * 100}
            cy={
              100 - ((item.weight - minWeight) / (maxWeight - minWeight)) * 100
            }
            r="1.8"
            fill="var(--color-brand)"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      <span className="absolute right-1 top-1 text-[10px] text-muted">
        {Math.max(...weights).toFixed(1)} kg
      </span>
      <span className="absolute right-1 bottom-1 text-[10px] text-muted">
        {Math.min(...weights).toFixed(1)} kg
      </span>
    </div>
  );
}

function HydrationChart({
  data,
  target,
}: {
  data: HealthSnapshot[];
  target: number;
}) {
  const ratio = Math.min(
    100,
    (average(data.map((item) => item.water)) / target) * 100,
  );
  return (
    <div className="rounded-2xl bg-hydration-soft/70 p-4">
      <div className="flex justify-between items-end">
        <div>
          <p className="text-xs text-hydration">Rata-rata tercapai</p>
          <p className="font-display text-3xl font-bold text-hydration mt-1">
            {Math.round(ratio)}%
          </p>
        </div>
        <span className="text-3xl" aria-hidden>
          💧
        </span>
      </div>
      <div className="h-3 rounded-full bg-white/70 mt-4 overflow-hidden">
        <div
          className="h-full rounded-full bg-hydration transition-all"
          style={{ width: `${ratio}%` }}
        />
      </div>
    </div>
  );
}

function EmptyChart({ text }: { text: string }) {
  return (
    <div className="h-40 flex items-center justify-center border border-dashed border-line rounded-2xl text-xs text-muted text-center px-5">
      {text}
    </div>
  );
}
