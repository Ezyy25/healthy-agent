"use client";

/**
 * Provider global fitur "Atur Jam Makan".
 *
 * Bertugas:
 * - Menyimpan jadwal makan (pagi/siang/sore) per-user di localStorage.
 * - Menggerakkan "mesin pengingat" yang berjalan terus selama aplikasi
 *   terbuka: setiap ±30 detik mengecek waktu, lalu memicu notifikasi saat
 *   jam makan tiba ("Waktunya makan!") dan peringatan bila melewati batas
 *   toleransi ("Kamu telat makan — segera makan").
 * - Mengelola riwayat notifikasi, suara, dan notifikasi native browser.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/context/AuthContext";
import {
  DEFAULT_SCHEDULE,
  DEFAULT_SETTINGS,
  combineSchedule,
  combineSettings,
  computeMealStates,
  dayKey,
  formatTime,
  loadEaten,
  loadFired,
  loadNotifications,
  loadSchedule,
  loadSettings,
  mealFromTime,
  playNotificationSound,
  saveEaten,
  saveFired,
  saveNotifications,
  saveSchedule as persistSchedule,
  saveSettings,
} from "@/lib/meal-schedule";
import type {
  EatenRecord,
  MealId,
  MealNotification,
  MealSchedule,
  MealSettings,
  MealState,
  NotificationKind,
} from "@/lib/meal-schedule";
import type { FoodItem } from "@/lib/types";

const TICK_MS = 30_000;

interface MealScheduleContextValue {
  schedule: MealSchedule;
  settings: MealSettings;
  states: MealState[];
  notifications: MealNotification[];
  unreadCount: number;
  now: Date;
  saveSchedule: (schedule: MealSchedule) => void;
  resetSchedule: () => void;
  updateSetting: <K extends keyof MealSettings>(
    key: K,
    value: MealSettings[K],
  ) => void;
  /** Konfirmasi satu waktu makan dari aktivitas nyata (hasil scan foto). */
  confirmMealFromActivity: (
    atIso: string,
    source: FoodItem["source_type"],
  ) => void;
  /** Sinkronkan konfirmasi dari daftar makanan yang sudah tercatat hari ini. */
  syncFromFoodItems: (items: FoodItem[]) => void;
  clearNotifications: () => void;
  markAllRead: () => void;
  enableBrowserNotifications: () => Promise<boolean>;
  sendTestNotification: () => void;
  stateFor: (id: MealId) => MealState | undefined;
}

const MealScheduleContext = createContext<MealScheduleContextValue | undefined>(
  undefined,
);

function makeNotification(
  kind: NotificationKind,
  mealId: MealId | null,
  title: string,
  body: string,
): MealNotification {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    mealId,
    title,
    body,
    at: new Date().toISOString(),
    read: false,
  };
}

export function MealScheduleProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [schedule, setSchedule] = useState<MealSchedule>(DEFAULT_SCHEDULE);
  const [settings, setSettings] = useState<MealSettings>(DEFAULT_SETTINGS);
  const [eaten, setEaten] = useState<EatenRecord>({});
  const [notifications, setNotifications] = useState<MealNotification[]>([]);
  const [now, setNow] = useState<Date>(() => new Date());

  // Ref agar mesin pengingat selalu membaca nilai terbaru (nilai di-refresh
  // lewat effect di bawah; di luar render).
  const userIdRef = useRef<number | null>(userId);
  const scheduleRef = useRef<MealSchedule>(schedule);
  const settingsRef = useRef<MealSettings>(settings);
  const eatenRef = useRef<EatenRecord>(eaten);
  const dateRef = useRef<string>(dayKey());

  /* Sinkronkan ref dengan state terbaru (dibaca interval/mesin pengingat). */
  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);
  useEffect(() => {
    scheduleRef.current = schedule;
  }, [schedule]);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);
  useEffect(() => {
    eatenRef.current = eaten;
  }, [eaten]);

  /* Memuat data per-user ketika login / berganti akun */
  useEffect(() => {
    if (userId == null) return;
    const today = dayKey();
    dateRef.current = today;
    const loadedSchedule = combineSchedule(loadSchedule(userId));
    const loadedSettings = combineSettings(loadSettings(userId));
    const loadedEaten = loadEaten(userId, today);
    const loadedNotifications = loadNotifications(userId);
    // Ref langsung di-update supaya evaluasi pertama mesin pengingat
    // langsung memakai jadwal milik user ini (bukan nilai lama).
    scheduleRef.current = loadedSchedule;
    settingsRef.current = loadedSettings;
    eatenRef.current = loadedEaten;
    setSchedule(loadedSchedule);
    setSettings(loadedSettings);
    setEaten(loadedEaten);
    setNotifications(loadedNotifications);
  }, [userId]);
  /* Mesin pengingat: cek tiap 30 detik + saat tab kembali fokus */
  useEffect(() => {
    if (userId == null) return;

    let disposed = false;

    const fireBrowser = (n: MealNotification) => {
      if (
        typeof window === "undefined" ||
        !("Notification" in window) ||
        !settingsRef.current.browserNotifications ||
        Notification.permission !== "granted"
      ) {
        return;
      }
      try {
        new Notification(n.title, { body: n.body, tag: n.id });
      } catch {
        // Browser lama / izin bermasalah — abaikan.
      }
    };

    const pushNotifications = (created: MealNotification[]) => {
      setNotifications((prev) => {
        const merged = [...created, ...prev].slice(0, 50);
        saveNotifications(userId, merged);
        return merged;
      });
      if (settingsRef.current.sound) playNotificationSound();
      created.forEach(fireBrowser);
    };

    const tick = () => {
      if (disposed || userIdRef.current == null) return;
      const today = dayKey();

      // Ganti hari: muat ulang catatan "sudah makan" untuk hari baru.
      if (today !== dateRef.current) {
        dateRef.current = today;
        eatenRef.current = loadEaten(userIdRef.current, today);
        setEaten(eatenRef.current);
      }

      const current = new Date();
      setNow(current);

      const states = computeMealStates(
        scheduleRef.current,
        eatenRef.current,
        settingsRef.current.graceMinutes,
        current,
      );

      const fired = loadFired(userIdRef.current, today);
      const nextFired = { ...fired };
      const created: MealNotification[] = [];

      for (const s of states) {
        if (s.eaten) continue;

        if (s.condition === "due" && nextFired[s.id] !== "reminder") {
          nextFired[s.id] = "reminder";
          created.push(
            makeNotification(
              "reminder",
              s.id,
              `🍽️ ${s.emoji} ${s.label}`,
              `Saatnya makan! Jadwalmu ${formatTime(s.time)} — yuk isi energi.`,
            ),
          );
        } else if (s.condition === "late" && nextFired[s.id] !== "late") {
          nextFired[s.id] = "late";
          created.push(
            makeNotification(
              "late",
              s.id,
              `⚠️ Kamu telat makan ${s.label.toLowerCase()}`,
              `Jadwal ${formatTime(s.time)} sudah lewat. Segera makan biar tetap berenergi!`,
            ),
          );
        }
      }

      if (created.length > 0) {
        saveFired(userIdRef.current, today, nextFired);
        pushNotifications(created);
      }
    };

    // Evaluasi segera saat mount, lalu tiap interval.
    tick();
    const timer = window.setInterval(tick, TICK_MS);
    const onFocus = () => tick();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [userId]);
  /* Aksi-aksi dari UI */
  const saveSchedule = useCallback(
    (next: MealSchedule) => {
      setSchedule(next);
      scheduleRef.current = next;
      if (userId != null) persistSchedule(userId, next);
    },
    [userId],
  );

  const resetSchedule = useCallback(() => {
    saveSchedule(DEFAULT_SCHEDULE);
  }, [saveSchedule]);

  const updateSetting = useCallback(
    <K extends keyof MealSettings>(key: K, value: MealSettings[K]) => {
      setSettings((prev) => {
        const next = { ...prev, [key]: value };
        settingsRef.current = next;
        if (userId != null) saveSettings(userId, next);
        return next;
      });
    },
    [userId],
  );

  /**
   * Konfirmasi otomatis dari aktivitas nyata (mis. scan foto makanan):
   * tentukan waktu makan yang sedang berlangsung dari jam kejadian,
   * lalu catat konfirmasinya. Konfirmasi yang sudah ada tidak ditimpa.
   */
  const confirmMealFromActivity = useCallback(
    (atIso: string, source: FoodItem["source_type"]) => {
      if (userId == null) return;
      const at = new Date(atIso);
      if (Number.isNaN(at.getTime())) return;
      // Hanya untuk makanan hari ini.
      if (dayKey(at) !== dayKey()) return;

      const mealId = mealFromTime(scheduleRef.current, at);
      if (!mealId) return;
      if (eatenRef.current[mealId]) return;

      const next: EatenRecord = {
        ...eatenRef.current,
        [mealId]: {
          at: at.toISOString(),
          method: source === "SCAN" ? "scan" : "manual",
        },
      };
      eatenRef.current = next;
      setEaten(next);
      saveEaten(userId, dayKey(), next);
    },
    [userId],
  );

  /**
   * Sinkronkan konfirmasi dari daftar makanan yang sudah tercatat di
   * backend hari ini (dipakai saat halaman memuat catatan). Berguna bila
   * makanan tercatat lewat jalur lain / sesi lain.
   */
  const syncFromFoodItems = useCallback(
    (items: FoodItem[]) => {
      if (userId == null) return;
      let changed = false;
      const next: EatenRecord = { ...eatenRef.current };

      for (const item of items) {
        if (!item.created_at) continue;
        const at = new Date(item.created_at);
        if (Number.isNaN(at.getTime())) continue;
        if (dayKey(at) !== dayKey()) continue;

        const mealId = mealFromTime(scheduleRef.current, at);
        if (!mealId) continue;
        if (next[mealId]) continue;

        next[mealId] = {
          at: at.toISOString(),
          method: item.source_type === "SCAN" ? "scan" : "manual",
        };
        changed = true;
      }

      if (!changed) return;
      eatenRef.current = next;
      setEaten(next);
      saveEaten(userId, dayKey(), next);
    },
    [userId],
  );

  const writeNotifications = useCallback(
    (next: MealNotification[]) => {
      setNotifications(next);
      if (userId != null) saveNotifications(userId, next);
    },
    [userId],
  );

  const clearNotifications = useCallback(() => {
    writeNotifications([]);
  }, [writeNotifications]);

  const markAllRead = useCallback(() => {
    writeNotifications(notifications.map((n) => ({ ...n, read: true })));
  }, [notifications, writeNotifications]);

  const enableBrowserNotifications = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return false;
    }
    const permission = await Notification.requestPermission();
    const granted = permission === "granted";
    if (granted) updateSetting("browserNotifications", true);
    return granted;
  }, [updateSetting]);

  const sendTestNotification = useCallback(() => {
    const n = makeNotification(
      "test",
      null,
      "🔔 Notifikasi Jam Makan Aktif",
      "Ini contoh notifikasi. Semua jadwal makanku sudah siap dipantau!",
    );
    writeNotifications([n, ...notifications].slice(0, 50));
    if (settingsRef.current.sound) playNotificationSound();
    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      settingsRef.current.browserNotifications &&
      Notification.permission === "granted"
    ) {
      try {
        new Notification(n.title, { body: n.body });
      } catch {
        // abaikan
      }
    }
  }, [notifications, writeNotifications]);

  const states = useMemo(
    () =>
      userId != null
        ? computeMealStates(schedule, eaten, settings.graceMinutes, now)
        : [],
    [userId, schedule, eaten, settings.graceMinutes, now],
  );

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );

  const stateFor = useCallback(
    (id: MealId) => states.find((s) => s.id === id),
    [states],
  );

  const value: MealScheduleContextValue = {
    schedule,
    settings,
    states,
    notifications,
    unreadCount,
    now,
    saveSchedule,
    resetSchedule,
    updateSetting,
    confirmMealFromActivity,
    syncFromFoodItems,
    clearNotifications,
    markAllRead,
    enableBrowserNotifications,
    sendTestNotification,
    stateFor,
  };

  return (
    <MealScheduleContext.Provider value={value}>
      {children}
    </MealScheduleContext.Provider>
  );
}

export function useMealSchedule() {
  const ctx = useContext(MealScheduleContext);
  if (!ctx) {
    throw new Error(
      "useMealSchedule harus dipakai di dalam MealScheduleProvider",
    );
  }
  return ctx;
}
