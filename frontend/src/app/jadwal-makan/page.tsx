"use client";

/**
 * Halaman "Atur Jam Makan".
 * User mengatur jam makan pagi/siang/sore, menandai sudah makan,
 * melihat status (tepat waktu / telat), dan mengelola notifikasi.
 */

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useMealSchedule } from "@/context/MealScheduleContext";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/Button";
import {
  MEAL_DEFINITIONS,
  eatenCount,
  type MealSchedule,
  type MealState,
} from "@/lib/meal-schedule";

export default function MealSchedulePage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const meal = useMealSchedule();

  const [draft, setDraft] = useState<MealSchedule>(() => meal.schedule);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) router.push("/login");
  }, [isLoading, user, router]);

  useEffect(() => {
    setDraft(meal.schedule);
  }, [meal.schedule]);

  if (isLoading || !user) {
    return (
      <main className="flex-1 flex items-center justify-center px-4">
        <p className="soft-chip">Memuat jadwal makan…</p>
      </main>
    );
  }

  const todayLabel = meal.now.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const timeNow = meal.now.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const done = eatenCount(meal.states);
  const total = MEAL_DEFINITIONS.length;
  const percent = done / total;

  function handleSave(e: FormEvent) {
    e.preventDefault();
    meal.saveSchedule(draft);
    setFlash(true);
    window.setTimeout(() => setFlash(false), 2500);
  }

  return (
    <div className="flex-1 flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 pb-6">
        {/* Hero */}
        <section className="reveal-on-load pt-8 pb-6">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="soft-chip">🍽️ Atur Jam Makan</span>
            <span className="text-xs text-muted">
              {todayLabel} • {timeNow}
            </span>
          </div>
          <h1 className="section-title text-3xl sm:text-4xl mb-3 leading-[1.15]">
            Jadwal Makanku
          </h1>
          <p className="text-base text-muted max-w-lg leading-relaxed">
            Makan 3x sehari — pagi, siang, dan sore. Kamu akan diingatkan setiap
            waktu makan tiba, dan diberi peringatan bila sudah telat.
          </p>
        </section>

        {/* Status makan hari ini */}
        <section className="reveal-on-load surface-card p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="section-title text-sm">Status Makan Hari Ini</p>
            <span className="tabular font-display text-sm font-semibold">
              {done}/{total} makan
            </span>
          </div>
          <div className="h-3 rounded-full bg-paper border border-line/60 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand to-energy transition-all duration-700"
              style={{ width: `${percent * 100}%` }}
            />
          </div>
          {done === total ? (
            <p className="text-xs text-brand mt-3">
              Semua waktu makan hari ini sudah terkonfirmasi — hebat! 🎉
            </p>
          ) : (
            <p className="text-xs text-muted mt-3 leading-5">
              Setiap kali kamu scan foto makanan di{" "}
              <span className="font-medium text-ink">Scan Makanan</span>, waktu
              makan yang sedang berlangsung otomatis terkonfirmasi. Target makan{" "}
              {total}x sehari.
            </p>
          )}
        </section>

        {/* 3 waktu makan */}
        <section className="reveal-on-load mb-6 space-y-4">
          {meal.states.map((state) => (
            <MealCard
              key={state.id}
              state={state}
              value={draft[state.id]}
              onChange={(v) => setDraft((prev) => ({ ...prev, [state.id]: v }))}
            />
          ))}
        </section>

        {/* Simpan / reset jadwal */}
        <section className="reveal-on-load surface-card p-5 mb-6">
          <form
            onSubmit={handleSave}
            className="flex flex-col sm:flex-row gap-3"
          >
            <Button type="submit" className="sm:flex-1">
              💾 Simpan Jam Makan
            </Button>
            <Button
              type="button"
              variant="outline"
              className="sm:flex-1"
              onClick={meal.resetSchedule}
            >
              Atur ulang ke jadwal standar
            </Button>
          </form>
          {flash && (
            <p className="text-xs text-brand mt-3">
              Jadwal tersimpan ✓ Pengingat mengikuti waktu baru.
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
/* ------------------------------------------------------------------ */
/* Komponen pembantu halaman                                            */
/* ------------------------------------------------------------------ */

function MealCard({
  state,
  value,
  onChange,
}: {
  state: MealState;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="surface-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-2xl shrink-0" aria-hidden>
            {state.emoji}
          </span>
          <div className="min-w-0">
            <p className="section-title text-base">{state.label}</p>
            <p className="text-xs text-muted mt-0.5 leading-4">
              {state.description}
            </p>
          </div>
        </div>
        <StatusBadge state={state} />
      </div>

      <p
        className={`text-sm mt-3 mb-4 leading-5 ${
          state.condition === "due"
            ? "text-brand font-medium"
            : state.condition === "late"
              ? "text-energy font-medium"
              : "text-muted"
        }`}
      >
        {state.statusText}
      </p>

      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <label className="block">
          <span className="block text-xs text-muted mb-1.5">Jam makan</span>
          <input
            type="time"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="field-input"
          />
        </label>
      </div>
    </div>
  );
}

function StatusBadge({ state }: { state: MealState }) {
  let label: string;
  let cls: string;

  if (state.eaten) {
    if (state.onTime) {
      label = "✓ Tepat waktu";
      cls = "bg-brand/10 text-brand";
    } else {
      label = "✓ Selesai (telat)";
      cls = "bg-warn-soft text-warn";
    }
  } else if (state.condition === "due") {
    label = "🔔 Waktunya makan!";
    cls = "bg-brand text-white";
  } else if (state.condition === "late") {
    label = "⚠️ Telat makan!";
    cls = "bg-energy text-white";
  } else if (state.condition === "near") {
    label = "Segera";
    cls = "bg-hydration-soft text-hydration";
  } else {
    label = "Menunggu";
    cls = "bg-paper/70 text-muted border border-line/70";
  }

  return (
    <span
      className={`shrink-0 inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold ${cls}`}
    >
      {label}
    </span>
  );
}
