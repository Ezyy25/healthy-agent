"use client";

/**
 * Toast popup pengingat jam makan — muncul di pojok kanan bawah saat
 * notifikasi baru datang ("Waktunya makan!", "Kamu telat makan", dst).
 * Menghilang otomatis setelah beberapa detik atau diklik user.
 */

import { useEffect, useRef, useState } from "react";
import { useMealSchedule } from "@/context/MealScheduleContext";
import {
  kindBg,
  kindLabel,
  type MealNotification,
} from "@/lib/meal-schedule";

const TOAST_DURATION_MS = 9_000;
const MAX_VISIBLE = 3;

export function MealToasts() {
  const { notifications } = useMealSchedule();
  const [visibleIds, setVisibleIds] = useState<string[]>([]);
  const lastIdsRef = useRef<Set<string>>(new Set());

  // Deteksi notifikasi baru (belum pernah terlihat & belum dibaca).
  useEffect(() => {
    if (notifications.length === 0) {
      lastIdsRef.current = new Set();
      return;
    }

    const currentIds = new Set(notifications.map((n) => n.id));
    const fresh = notifications
      .filter((n) => !n.read && !lastIdsRef.current.has(n.id))
      .map((n) => n.id);
    lastIdsRef.current = currentIds;

    if (fresh.length === 0) return;
    // Delay 0 supaya pemunculan toast tidak ketat dalam render yang sama.
    const timer = window.setTimeout(() => {
      setVisibleIds((prev) => {
        const merged = [...new Set([...prev, ...fresh])];
        return merged.slice(-MAX_VISIBLE);
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [notifications]);

  function dismiss(id: string) {
    setVisibleIds((prev) => prev.filter((x) => x !== id));
  }

  const toasts = visibleIds
    .map((id) => notifications.find((n) => n.id === id))
    .filter((n): n is MealNotification => Boolean(n));

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 sm:left-auto sm:right-4 sm:translate-x-0 z-50 flex flex-col gap-2.5 w-[min(92vw,22rem)]">
      {toasts.map((n) => (
        <ToastItem
          key={n.id}
          notification={n}
          onDismiss={() => dismiss(n.id)}
        />
      ))}
    </div>
  );
}

function ToastItem({
  notification,
  onDismiss,
}: {
  notification: MealNotification;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, TOAST_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [onDismiss]);

  return (
    <button
      type="button"
      onClick={onDismiss}
      className="reveal-on-load surface-card p-4 text-left flex items-start gap-3 cursor-pointer hover:-translate-y-0.5"
      aria-label="Tutup notifikasi"
    >
      <span
        className={`mt-0.5 shrink-0 inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${kindBg(
          notification.kind,
        )} ${"text-ink"}`}
      >
        {kindLabel(notification.kind)}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink leading-snug">
          {notification.title}
        </span>
        <span className="block text-xs text-muted leading-5 mt-0.5">
          {notification.body}
        </span>
      </span>
      <span className="shrink-0 text-muted/60" aria-hidden>
        ✕
      </span>
    </button>
  );
}