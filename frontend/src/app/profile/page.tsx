"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useMealSchedule } from "@/context/MealScheduleContext";
import { kindBg, kindLabel } from "@/lib/meal-schedule";
import { ActivityLevel, Goal, HealthProfile } from "@/lib/types";
import { getHealthProfile, saveHealthProfile } from "@/lib/health-profile";
import { ApiError } from "@/lib/api";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/Button";

const ACTIVITY_LABEL: Record<ActivityLevel, string> = {
  sedentary: "Sedentari — jarang aktivitas fisik",
  light: "Ringan — olahraga 1–3x per minggu",
  moderate: "Sedang — olahraga 3–5x per minggu",
  active: "Aktif — olahraga 6–7x per minggu",
  very_active: "Sangat aktif — kerja fisik / atlet",
};

const GOAL_LABEL: Record<Goal, string> = {
  lose_weight: "Menurunkan berat badan",
  maintain: "Menjaga berat badan",
  gain_muscle: "Membangun otot",
};

interface FormState {
  age: string;
  gender: "male" | "female";
  weight_kg: string;
  height_cm: string;
  activity_level: ActivityLevel;
  goal: Goal;
}

const EMPTY_FORM: FormState = {
  age: "",
  gender: "male",
  weight_kg: "",
  height_cm: "",
  activity_level: "light",
  goal: "maintain",
};

const GRACE_OPTIONS = [30, 45, 60, 90, 120];

export default function ProfilePage() {
  const { user, token, isLoading, logout } = useAuth();
  const meal = useMealSchedule();
  const router = useRouter();

  const [browserSupported, setBrowserSupported] = useState(false);
  const [permissionState, setPermissionState] =
    useState<NotificationPermission | null>(null);

  const [profile, setProfile] = useState<HealthProfile | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "empty" | "done">(
    "loading",
  );
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) router.push("/login");
  }, [isLoading, user, router]);

  useEffect(() => {
    const raf = window.requestAnimationFrame(() => {
      const supported =
        typeof window !== "undefined" && "Notification" in window;
      setBrowserSupported(supported);
      if (supported) setPermissionState(Notification.permission);
    });
    return () => window.cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (!browserSupported || !("Notification" in window)) return;
    const has = () => setPermissionState(Notification.permission);
    window.addEventListener("focus", has);
    document.addEventListener("visibilitychange", has);
    return () => {
      window.removeEventListener("focus", has);
      document.removeEventListener("visibilitychange", has);
    };
  }, [browserSupported]);

  async function handleBrowserToggle(enable: boolean) {
    if (enable) {
      const ok = await meal.enableBrowserNotifications();
      if (ok) setPermissionState("granted");
      return;
    }
    meal.updateSetting("browserNotifications", false);
  }

  // Ambil profil kesehatan yang sudah tersimpan (kalau ada).
  useEffect(() => {
    if (!token) return;
    getHealthProfile(token)
      .then((p) => {
        setProfile(p);
        setForm({
          age: String(p.age),
          gender: p.gender,
          weight_kg: String(p.weight_kg),
          height_cm: String(p.height_cm),
          activity_level: p.activity_level,
          goal: p.goal,
        });
        setLoadState("done");
      })
      .catch(() => setLoadState("empty"));
  }, [token]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;

    setError(null);
    setIsSaving(true);

    const payload = {
      age: Number(form.age),
      gender: form.gender || "male",
      weight_kg: Number(form.weight_kg),
      height_cm: Number(form.height_cm),
      activity_level: form.activity_level || "light",
      goal: form.goal || "maintain",
    };

    try {
      const result = await saveHealthProfile(payload, token);

      setProfile(result);
      setForm({
        age: String(result.age),
        gender: result.gender,
        weight_kg: String(result.weight_kg),
        height_cm: String(result.height_cm),
        activity_level: result.activity_level,
        goal: result.goal,
      });
      setLoadState("done");
      setIsEditing(false);
      setSaved(true);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Gagal menyimpan profil. Pastikan backend sedang berjalan.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading || !user) {
    return (
      <main className="flex-1 flex items-center justify-center px-4">
        <p className="soft-chip">Memuat profil…</p>
      </main>
    );
  }

  const initials = (user.name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  const joined = new Date(user.created_at).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <>
      <Navbar />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-6 pb-12 space-y-5">
        {/* Kartu akun */}
        <section className="surface-card p-6 flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="relative shrink-0">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-brand to-hydration text-white flex items-center justify-center font-display text-2xl font-bold shadow-[0_14px_30px_rgba(31,110,74,0.3)]">
              {initials || "👤"}
            </div>
            <span className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full bg-energy text-white flex items-center justify-center text-sm">
              🍃
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="section-title text-2xl sm:text-3xl truncate">
              {user.name}
            </h1>
            <p className="text-sm text-muted mt-1">{user.email}</p>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className="soft-chip">Member sejak {joined}</span>
              {loadState === "done" && profile && (
                <span className="soft-chip bg-hydration-soft !text-hydration">
                  🌱 Profil lengkap
                </span>
              )}
            </div>
          </div>
          <Button
            variant="outline"
            className="sm:w-auto px-5"
            onClick={() => logout()}
          >
            Keluar
          </Button>
        </section>

        <section className="surface-card p-5">
          <div className="flex items-center justify-between gap-3 mb-2">
            <p className="section-title text-sm">Notifikasi &amp; Pengingat</p>
            <Button
              type="button"
              variant="outline"
              onClick={meal.sendTestNotification}
              className="w-auto px-4 py-2"
            >
              Uji notifikasi
            </Button>
          </div>
          <p className="text-xs text-muted leading-5 mb-2">
            Pengingat dikirim otomatis saat jam makan tiba, dan jadi peringatan
            bila lewat dari jam makan + toleransi.
          </p>

          <div className="divide-y divide-line/60">
            <SettingRow
              title="🔊 Suara pengingat"
              desc="Bunyi 'biip' halus saat notifikasi muncul."
            >
              <Toggle
                checked={meal.settings.sound}
                onChange={(v) => meal.updateSetting("sound", v)}
              />
            </SettingRow>

            <SettingRow
              title="🔔 Notifikasi browser"
              desc={
                browserSupported
                  ? permissionState === "denied"
                    ? "Izin diblokir — aktifkan lewat pengaturan situs di browser."
                    : "Muncul di layar walau kamu sedang di tab lain. Berfungsi selagi aplikasi terbuka."
                  : "Browser ini tidak mendukung notifikasi desktop."
              }
              descColor={
                browserSupported && permissionState === "denied"
                  ? "text-energy"
                  : undefined
              }
            >
              <Toggle
                checked={meal.settings.browserNotifications}
                disabled={!browserSupported || permissionState === "denied"}
                onChange={handleBrowserToggle}
              />
            </SettingRow>

            <SettingRow
              title="⏱️ Toleransi keterlambatan"
              desc="Lewat jam makan + toleransi ini, kamu dianggap telat makan."
            >
              <select
                value={meal.settings.graceMinutes}
                onChange={(e) =>
                  meal.updateSetting("graceMinutes", Number(e.target.value))
                }
                className="field-select w-auto"
                aria-label="Toleransi keterlambatan"
              >
                {GRACE_OPTIONS.map((g) => (
                  <option key={g} value={g}>
                    {g} menit
                  </option>
                ))}
              </select>
            </SettingRow>
          </div>
        </section>

        <section className="surface-card p-5">
          <div className="flex items-baseline justify-between mb-3">
            <p className="section-title text-sm">Riwayat Notifikasi</p>
            {meal.notifications.length > 0 && (
              <button
                type="button"
                onClick={meal.clearNotifications}
                className="text-xs text-muted font-medium hover:text-energy transition"
              >
                Bersihkan riwayat
              </button>
            )}
          </div>

          {meal.notifications.length === 0 ? (
            <p className="text-sm text-muted bg-white/50 rounded-2xl border border-line/70 px-4 py-6 text-center">
              Belum ada notifikasi — pengingat muncul otomatis mendekati jam
              makan.
            </p>
          ) : (
            <ul className="divide-y divide-line/60 overflow-hidden">
              {meal.notifications.map((n) => (
                <li key={n.id} className="px-4 py-3 flex items-center gap-3">
                  <span
                    className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${kindBg(n.kind)} text-ink`}
                  >
                    {kindLabel(n.kind)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink leading-snug">
                      {n.title}
                    </p>
                    <p className="text-xs text-muted leading-5 mt-0.5">
                      {n.body}
                    </p>
                  </div>
                  <span className="shrink-0 text-[10px] text-muted tabular">
                    {timeAgo(n.at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {saved && (
          <p className="text-sm bg-brand/10 text-brand px-4 py-3 rounded-2xl">
            ✅ Berhasil disimpan! BMR, TDEE, dan target kalori sudah dihitung
            ulang.
          </p>
        )}
        {error && (
          <p className="text-sm text-energy bg-energy-soft/80 px-4 py-3 rounded-2xl">
            {error}
          </p>
        )}

        {/* Hasil BMR/TDEE (kalau sudah ada datanya) */}
        {loadState === "done" && profile && !isEditing && (
          <ProfileResult profile={profile} onEdit={() => setIsEditing(true)} />
        )}

        {/* Form isi/ubah profil kesehatan */}
        {isEditing || loadState === "empty" ? (
          <ProfileForm
            form={form}
            update={update}
            onSubmit={handleSubmit}
            isSaving={isSaving}
            isEditing={loadState === "done"}
            onCancel={() => setIsEditing(false)}
          />
        ) : (
          loadState === "loading" && (
            <p className="text-sm text-muted text-center py-8">
              Memuat profil kesehatan…
            </p>
          )
        )}
      </main>
    </>
  );
}
function ProfileResult({
  profile,
  onEdit,
}: {
  profile: HealthProfile;
  onEdit: () => void;
}) {
  return (
    <>
      {/* Data tubuh */}
      <section className="surface-card p-6">
        <div className="flex items-center justify-between mb-4">
          <p className="section-title text-lg">Data Tubuh</p>
          <button
            onClick={onEdit}
            className="text-xs font-semibold text-brand hover:underline"
          >
            Ubah ✏️
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <InfoTile label="Umur" value={`${profile.age} tahun`} />
          <InfoTile
            label="Jenis kelamin"
            value={profile.gender === "male" ? "Laki-laki" : "Perempuan"}
          />
          <InfoTile
            label="Berat badan"
            value={`${Number(profile.weight_kg)} kg`}
          />
          <InfoTile
            label="Tinggi badan"
            value={`${Number(profile.height_cm)} cm`}
          />
          <InfoTile
            label="Aktivitas"
            value={ACTIVITY_LABEL[profile.activity_level]}
            wide
          />
          <InfoTile label="Tujuan" value={GOAL_LABEL[profile.goal]} wide />
        </div>
      </section>

      {/* Metabolisme */}
      {profile.bmr !== undefined &&
      profile.tdee !== undefined &&
      profile.calorie_target !== undefined ? (
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <MetricCard
            label="BMR"
            value={profile.bmr.toLocaleString("id-ID")}
            unit="kkal/hari"
            accent="text-hydration"
            hint="Kalori saat tubuh istirahat total"
          />
          <MetricCard
            label="TDEE"
            value={profile.tdee.toLocaleString("id-ID")}
            unit="kkal/hari"
            accent="text-ink"
            hint="Kalori untuk aktivitas harianmu"
          />
          <MetricCard
            label="Target harian"
            value={profile.calorie_target.toLocaleString("id-ID")}
            unit="kkal"
            accent="text-energy"
            hint={`Sesuai tujuan: ${GOAL_LABEL[profile.goal].toLowerCase()}`}
          />
        </section>
      ) : (
        <section className="surface-card p-5 text-sm text-muted leading-6">
          📊 Sedang menghitung BMR, TDEE, dan target kalori Anda...
        </section>
      )}

      <section className="surface-card p-5 text-sm text-muted leading-6">
        💡 <b className="text-ink">BMR</b> = Basal Metabolic Rate, energi yang
        dibakar tubuh saat istirahat. <b className="text-ink">TDEE</b> = Total
        Daily Energy Expenditure, kebutuhan kalori harian dengan aktivitas.
        Target harianmu sudah disesuaikan otomatis dengan tujuan yang dipilih.
      </section>
    </>
  );
}
function ProfileForm({
  form,
  update,
  onSubmit,
  isSaving,
  isEditing,
  onCancel,
}: {
  form: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  onSubmit: (e: FormEvent) => void;
  isSaving: boolean;
  isEditing: boolean;
  onCancel: () => void;
}) {
  return (
    <form onSubmit={onSubmit} className="surface-card p-6 space-y-5">
      <div>
        <span className="soft-chip mb-3 inline-flex">
          {isEditing ? "Ubah profil kesehatan" : "Lengkapi profil kesehatan"}
        </span>
        <h2 className="section-title text-xl mt-3">
          Data untuk hitung BMR &amp; TDEE
        </h2>
        <p className="text-sm text-muted mt-1 leading-6">
          Isi sekali, kami hitung kebutuhan kalori harianmu secara otomatis.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Umur (tahun)">
          <input
            type="number"
            min={10}
            max={100}
            required
            value={form.age}
            onChange={(e) => update("age", e.target.value)}
            className="field-input"
            placeholder="cth: 25"
          />
        </Field>

        <Field label="Jenis kelamin">
          <select
            required
            value={form.gender}
            onChange={(e) =>
              update("gender", e.target.value as FormState["gender"])
            }
            className="field-select"
          >
            <option value="male">Laki-laki</option>
            <option value="female">Perempuan</option>
          </select>
        </Field>

        <Field label="Berat badan (kg)">
          <input
            type="number"
            min={30}
            max={300}
            step="0.1"
            required
            value={form.weight_kg}
            onChange={(e) => update("weight_kg", e.target.value)}
            className="field-input"
            placeholder="cth: 65"
          />
        </Field>

        <Field label="Tinggi badan (cm)">
          <input
            type="number"
            min={100}
            max={250}
            required
            value={form.height_cm}
            onChange={(e) => update("height_cm", e.target.value)}
            className="field-input"
            placeholder="cth: 170"
          />
        </Field>
      </div>

      <Field label="Tingkat aktivitas">
        <select
          required
          value={form.activity_level}
          onChange={(e) =>
            update(
              "activity_level",
              e.target.value as FormState["activity_level"],
            )
          }
          className="field-select"
        >
          {(Object.keys(ACTIVITY_LABEL) as ActivityLevel[]).map((key) => (
            <option key={key} value={key}>
              {ACTIVITY_LABEL[key]}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Tujuan">
        <select
          required
          value={form.goal}
          onChange={(e) => update("goal", e.target.value as FormState["goal"])}
          className="field-select"
        >
          {(Object.keys(GOAL_LABEL) as Goal[]).map((key) => (
            <option key={key} value={key}>
              {GOAL_LABEL[key]}
            </option>
          ))}
        </select>
      </Field>

      <div className="flex gap-3">
        <Button type="submit" disabled={isSaving} className="flex-1">
          {isSaving
            ? "Menyimpan & menghitung…"
            : isEditing
              ? "Simpan perubahan"
              : "Simpan profil"}
        </Button>
        {isEditing && (
          <Button
            variant="outline"
            type="button"
            onClick={onCancel}
            className="flex-1"
          >
            Batal
          </Button>
        )}
      </div>
    </form>
  );
}

function SettingRow({
  title,
  desc,
  descColor,
  children,
}: {
  title: string;
  desc: string;
  descColor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{title}</p>
        <p className={`text-xs mt-0.5 leading-5 ${descColor ?? "text-muted"}`}>
          {desc}
        </p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
        checked ? "bg-brand" : "bg-line"
      } ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
          checked ? "translate-x-5" : ""
        }`}
      />
    </button>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "baru saja";
  if (min < 60) return `${min} mnt lalu`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} jam lalu`;
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
  });
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs text-muted mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function InfoTile({
  label,
  value,
  wide,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div
      className={`${wide ? "col-span-2" : "col-span-1"} rounded-2xl border border-line/70 bg-paper/60 px-4 py-3`}
    >
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p className="text-sm font-medium text-ink mt-1">{value}</p>
    </div>
  );
}

function MetricCard({
  label,
  value,
  unit,
  accent,
  hint,
}: {
  label: string;
  value: string;
  unit: string;
  accent: string;
  hint: string;
}) {
  return (
    <div className="surface-card p-4 text-center">
      <p className="text-xs text-muted mb-1.5">{label}</p>
      <p className={`tabular font-display text-2xl font-bold ${accent}`}>
        {value}
        <span className="text-[10px] font-sans font-normal text-muted ml-0.5">
          {unit}
        </span>
      </p>
      <p className="text-[11px] text-muted mt-2 leading-4">{hint}</p>
    </div>
  );
}
