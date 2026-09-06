/**
 * Logika inti fitur "Atur Jam Makan".
 *
 * Konsep:
 * - Setiap hari user diharapkan makan 3x: pagi, siang, sore.
 * - Setiap waktu makan punya jam target ("HH:MM") yang bisa diatur user.
 * - Kalau belum tercatat "sudah makan" dan waktu sudah melewati
 *   jam makan + toleransi (grace), user dianggap TELAT MAKAN.
 * - Semua data disimpan per-user di localStorage (tidak ada endpoint
 *   backend khusus untuk fitur ini), jadi data mengikuti akun user saat login.
 */

export type MealId = "pagi" | "siang" | "sore";

export type MealSchedule = Record<MealId, string>;

export interface MealDefinition {
  id: MealId;
  label: string;
  emoji: string;
  description: string;
}

export interface MealSettings {
  /** Toleransi keterlambatan dalam menit. Lewat ini dianggap telat makan. */
  graceMinutes: number;
  /** Bunyi "biip" saat notifikasi muncul. */
  sound: boolean;
  /** Notifikasi native browser (perlu izin user). */
  browserNotifications: boolean;
}

export type MealCondition = "upcoming" | "near" | "due" | "late" | "done";

export interface MealState {
  id: MealId;
  label: string;
  emoji: string;
  description: string;
  /** Jam target terkonfigurasi user, format "HH:MM". */
  time: string;
  condition: MealCondition;
  /** Kalimat status manusiawi, mis. "Waktunya makan sekarang!". */
  statusText: string;
  eaten: boolean;
  /** Waktu konfirmasi makan (ISO), null bila belum makan. */
  eatenAt: string | null;
  /** Sumber konfirmasi: foto hasil scan atau catatan makanan. */
  method: "scan" | "manual" | null;
  /** True bila makan dikonfirmasi sebelum batas toleransi. */
  onTime: boolean;
  /**
   * Selisih menit dari jam target.
   * Negatif = masih menuju jam makan; positif = sudah masuk waktu makan;
   * untuk kondisi "late" = menit melewati batas toleransi.
   */
  deltaMinutes: number;
}

export type NotificationKind = "reminder" | "late" | "test";

export interface MealNotification {
  id: string;
  kind: NotificationKind;
  mealId: MealId | null;
  title: string;
  body: string;
  at: string; // ISO
  read: boolean;
}

/* ------------------------------------------------------------------ */
/* Konstanta & definisi                                                */
/* ------------------------------------------------------------------ */

export const MEAL_DEFINITIONS: MealDefinition[] = [
  {
    id: "pagi",
    label: "Sarapan Pagi",
    emoji: "🌅",
    description: "Berikan energi untuk memulai hari.",
  },
  {
    id: "siang",
    label: "Makan Siang",
    emoji: "☀️",
    description: "Isi ulang tenaga di tengah aktivitas.",
  },
  {
    id: "sore",
    label: "Makan Sore",
    emoji: "🌇",
    description: "Tutup hari dengan asupan yang seimbang.",
  },
];

export const DEFAULT_SCHEDULE: MealSchedule = {
  pagi: "07:00",
  siang: "12:00",
  sore: "17:00",
};

export const DEFAULT_GRACE_MINUTES = 60;

/** Menit mendekati jam makan untuk status "sebentar lagi". */
export const NEAR_MINUTES = 15;
/* ------------------------------------------------------------------ */
/* Kunci localStorage (di-scope per-user supaya antar akun terpisah)   */
/* ------------------------------------------------------------------ */

const SCHEDULE_KEY = "healthy_agent_meal_schedule";
const SETTINGS_KEY = "healthy_agent_meal_settings";
const EATEN_PREFIX = "healthy_agent_meal_eaten";
const NOTIFS_PREFIX = "healthy_agent_meal_notifs";
const FIRED_PREFIX = "healthy_agent_meal_fired";

function userKey(prefix: string, userId: number | string): string {
  return `${prefix}_${userId}`;
}

export function saveSchedule(userId: number | string, schedule: MealSchedule) {
  safeSet(userKey(SCHEDULE_KEY, userId), schedule);
}

export function loadSchedule(userId: number | string): MealSchedule | null {
  return safeGet<MealSchedule>(userKey(SCHEDULE_KEY, userId));
}

export function saveSettings(userId: number | string, settings: MealSettings) {
  safeSet(userKey(SETTINGS_KEY, userId), settings);
}

export function loadSettings(userId: number | string): MealSettings | null {
  return safeGet<MealSettings>(userKey(SETTINGS_KEY, userId));
}

/**
 * Konfirmasi makan dari aktivitas nyata (scan foto / catatan makanan).
 * - `at`     : waktu kejadian (ISO).
 * - `method` : dari foto hasil scan ("scan") atau dari catatan makanan lain.
 */
export interface MealConfirmation {
  at: string;
  method: "scan" | "manual";
}

export type EatenRecord = Partial<Record<MealId, MealConfirmation>>;

/**
 * Normalisasi isi localStorage: menampung data lama berbentuk string
 * (dari versi tombol manual) dan data baru berbentuk MealConfirmation.
 */
function normalizeEaten(raw: unknown): EatenRecord {
  if (!raw || typeof raw !== "object") return {};
  const source = raw as Record<string, unknown>;
  const out: EatenRecord = {};
  for (const id of MEAL_DEFINITIONS) {
    const value = source[id.id];
    if (typeof value === "string") {
      out[id.id] = { at: value, method: "manual" };
    } else if (
      value &&
      typeof value === "object" &&
      typeof (value as MealConfirmation).at === "string"
    ) {
      const conf = value as MealConfirmation;
      out[id.id] = {
        at: conf.at,
        method: conf.method === "scan" ? "scan" : "manual",
      };
    }
  }
  return out;
}

export function loadEaten(userId: number | string, date: string): EatenRecord {
  return normalizeEaten(safeGet<unknown>(`${userKey(EATEN_PREFIX, userId)}_${date}`));
}

export function saveEaten(
  userId: number | string,
  date: string,
  eaten: EatenRecord,
) {
  safeSet(`${userKey(EATEN_PREFIX, userId)}_${date}`, eaten);
}

export function loadNotifications(
  userId: number | string,
): MealNotification[] {
  return safeGet<MealNotification[]>(userKey(NOTIFS_PREFIX, userId)) ?? [];
}

export function saveNotifications(
  userId: number | string,
  notifications: MealNotification[],
) {
  safeSet(userKey(NOTIFS_PREFIX, userId), notifications.slice(0, 50));
}

export type FiredRecord = Partial<Record<MealId, "reminder" | "late">>;

export function loadFired(userId: number | string, date: string): FiredRecord {
  return safeGet<FiredRecord>(`${userKey(FIRED_PREFIX, userId)}_${date}`) ?? {};
}

export function saveFired(
  userId: number | string,
  date: string,
  fired: FiredRecord,
) {
  safeSet(`${userKey(FIRED_PREFIX, userId)}_${date}`, fired);
}

function safeGet<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function safeSet(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage penuh / private mode — abaikan tanpa merusak app.
  }
}

export const DEFAULT_SETTINGS: MealSettings = {
  graceMinutes: DEFAULT_GRACE_MINUTES,
  sound: true,
  browserNotifications: false,
};
/* ------------------------------------------------------------------ */
/* Helper waktu murni (mudah diuji, tanpa side-effect)                 */
/* ------------------------------------------------------------------ */

export function parseTime(time: string): number {
  const parts = time.split(":");
  const h = Number(parts[0]) || 0;
  const m = Number(parts[1]) || 0;
  return h * 60 + m;
}

export function formatTime(time: string): string {
  const mins = parseTime(time);
  const d = new Date();
  d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

export function minutesSinceMidnight(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

/** Kunci tanggal lokal "YYYY-MM-DD" — dipakai membagi catatan per hari. */
export function dayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function combineSchedule(stored: MealSchedule | null): MealSchedule {
  return {
    pagi: stored?.pagi ?? DEFAULT_SCHEDULE.pagi,
    siang: stored?.siang ?? DEFAULT_SCHEDULE.siang,
    sore: stored?.sore ?? DEFAULT_SCHEDULE.sore,
  };
}

export function combineSettings(stored: MealSettings | null): MealSettings {
  return {
    graceMinutes: stored?.graceMinutes ?? DEFAULT_SETTINGS.graceMinutes,
    sound: stored?.sound ?? DEFAULT_SETTINGS.sound,
    browserNotifications:
      stored?.browserNotifications ?? DEFAULT_SETTINGS.browserNotifications,
  };
}

/* ------------------------------------------------------------------ */
/* Status setiap waktu makan                                          */
/* ------------------------------------------------------------------ */

function humanDelta(deltaMin: number): string {
  const abs = Math.abs(deltaMin);
  const h = Math.floor(abs / 60);
  const m = Math.round(abs % 60);
  if (h > 0) return `${h} jam ${m > 0 ? `${m} menit` : ""}`.trim();
  return `${m} menit`;
}

function statusTextFor(
  def: MealDefinition,
  time: string,
  condition: MealCondition,
  onTime: boolean,
  deltaMinutes: number,
): string {
  if (condition === "done") {
    return onTime ? "Selesai • Tepat waktu" : `Selesai • Telat ${humanDelta(-deltaMinutes)}`;
  }
  if (condition === "upcoming") return `Mulai ${formatTime(time)}`;
  if (condition === "near") return `Segera — ± ${NEAR_MINUTES} menit lagi`;
  if (condition === "due") return `Waktunya makan sekarang!`;
  return `Telat makan ${humanDelta(deltaMinutes)} — belum tercatat`;
}

/**
 * Memilih waktu makan mana yang sedang/sedang berlangsung untuk suatu
 * waktu kejadian (mis. jam foto makanan di-scan), berdasarkan jadwal user.
 *
 * Aturan:
 * - sebelum jam siang  -> pagi
 * - sebelum jam sore   -> siang
 * - sisanya (malam)    -> sore
 */
export function mealFromTime(
  schedule: MealSchedule,
  d: Date,
): MealId | null {
  const m = minutesSinceMidnight(d);
  const siang = parseTime(schedule.siang);
  const sore = parseTime(schedule.sore);
  if (m < siang) return "pagi";
  if (m < sore) return "siang";
  return "sore";
}

/**
 * Hitung status 3 waktu makan pada waktu `now`.
 * Murni: tidak membaca/menulis storage.
 */
export function computeMealStates(
  schedule: MealSchedule,
  eaten: EatenRecord,
  graceMinutes: number,
  now: Date = new Date(),
): MealState[] {
  const nowMin = minutesSinceMidnight(now);

  return MEAL_DEFINITIONS.map((def) => {
    const time = schedule[def.id];
    const mealMin = parseTime(time);
    const lateAt = mealMin + graceMinutes;
    const confirmation = eaten[def.id] ?? null;

    let condition: MealCondition;
    let deltaMinutes: number;

    if (confirmation) {
      const eatenAt = confirmation.at;
      const eatenMin = minutesSinceMidnight(new Date(eatenAt));
      const onTime = eatenMin <= lateAt;
      condition = "done";
      // Negatif = masih "aman"; positif = kebablasan dari toleransi.
      deltaMinutes = lateAt - eatenMin;
      return {
        id: def.id,
        label: def.label,
        emoji: def.emoji,
        description: def.description,
        time,
        condition,
        statusText: statusTextFor(def, time, condition, onTime, deltaMinutes),
        eaten: true,
        eatenAt,
        method: confirmation.method,
        onTime,
        deltaMinutes,
      };
    }

    if (nowMin < mealMin - NEAR_MINUTES) {
      condition = "upcoming";
      deltaMinutes = nowMin - mealMin;
    } else if (nowMin < mealMin) {
      condition = "near";
      deltaMinutes = nowMin - mealMin;
    } else if (nowMin < lateAt) {
      condition = "due";
      deltaMinutes = nowMin - mealMin;
    } else {
      condition = "late";
      deltaMinutes = nowMin - lateAt;
    }

    return {
      id: def.id,
      label: def.label,
      emoji: def.emoji,
      description: def.description,
      time,
      condition,
      statusText: statusTextFor(def, time, condition, true, deltaMinutes),
      eaten: false,
      eatenAt: null,
      method: null,
      onTime: true,
      deltaMinutes,
    };
  });
}

/** Berapa waktu makan yang sudah tercatat "sudah makan" hari ini. */
export function eatenCount(states: MealState[]): number {
  return states.filter((s) => s.eaten).length;
}

/** Waktu makan yang paling mendesak saat ini (belum selesai), atau null. */
export function nextActionMeal(states: MealState[]): MealState | null {
  const unfinished = states.filter((s) => !s.eaten);
  if (unfinished.length === 0) return null;
  return unfinished.sort((a, b) => a.deltaMinutes - b.deltaMinutes)[0];
}
/* ------------------------------------------------------------------ */
/* Atribut notifikasi untuk UI                                          */
/* ------------------------------------------------------------------ */

export function kindLabel(kind: NotificationKind): string {
  if (kind === "reminder") return "Pengingat";
  if (kind === "late") return "Peringatan";
  return "Percobaan";
}

export function kindColor(kind: NotificationKind): string {
  if (kind === "reminder") return "text-brand";
  if (kind === "late") return "text-energy";
  return "text-hydration";
}

export function kindBg(kind: NotificationKind): string {
  if (kind === "reminder") return "bg-brand/10";
  if (kind === "late") return "bg-energy-soft";
  return "bg-hydration-soft";
}

/* ------------------------------------------------------------------ */
/* Suara notifikasi (Web Audio, tanpa aset audio eksternal)            */
/* ------------------------------------------------------------------ */

export function playNotificationSound() {
  if (typeof window === "undefined") return;
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const t0 = ctx.currentTime;

    const blip = (freq: number, delay: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t0 + delay);
      gain.gain.exponentialRampToValueAtTime(0.14, t0 + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + delay + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0 + delay);
      osc.stop(t0 + delay + 0.32);
    };

    blip(880, 0);
    blip(1174, 0.22);
    window.setTimeout(() => {
      ctx.close().catch(() => {});
    }, 1400);
  } catch {
    // Audio diblokir browser — abaikan.
  }
}