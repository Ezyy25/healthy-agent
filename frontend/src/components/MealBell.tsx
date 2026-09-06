"use client";

/**
 * Lonceng notifikasi jam makan di navbar.
 * Menampilkan badge jumlah belum terbaca, dan panel dropdown berisi
 * notifikasi terbaru (pengingat makan / peringatan telat makan).
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMealSchedule } from "@/context/MealScheduleContext";
import {
  kindBg,
  kindColor,
  kindLabel,
  type MealNotification,
} from "@/lib/meal-schedule";

export function MealBell() {
  const { notifications, unreadCount, markAllRead } = useMealSchedule();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Tutup panel saat klik di luar komponen.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const badge = unreadCount > 0 ? (unreadCount > 9 ? "9+" : String(unreadCount)) : null;

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifikasi jam makan${badge ? ` (${unreadCount} belum dibaca)` : ""}`}
        aria-expanded={open}
        className={`relative w-8 h-8 rounded-2xl flex items-center justify-center transition ${
          open
            ? "bg-brand/10 text-brand"
            : "text-muted hover:bg-paper/80 hover:text-ink"
        }`}
      >
        <BellIcon hasAlert={unreadCount > 0} />
        {badge && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-energy text-white text-[10px] font-bold flex items-center justify-center px-1 shadow">
            {badge}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-[min(88vw,20rem)] surface-card overflow-hidden z-40">
          <div className="flex items-center justify-between px-4 py-3 border-b border-line/70">
            <p className="section-title text-sm">Notifikasi Jam Makan</p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-[11px] font-semibold text-brand hover:underline"
              >
                Tandai dibaca
              </button>
            )}
          </div>

          <div className="max-h-[22rem] overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="text-sm text-muted px-4 py-8 text-center">
                Belum ada notifikasi. Yuk atur jadwal makanmu!
              </p>
            ) : (
              <ul className="divide-y divide-line/60">
                {notifications.slice(0, 8).map((n) => (
                  <NotificationRow key={n.id} notification={n} />
                ))}
              </ul>
            )}
          </div>

          <div className="px-4 py-2.5 border-t border-line/70">
            <Link
              href="/jadwal-makan"
              onClick={() => setOpen(false)}
              className="text-xs font-semibold text-brand hover:underline"
            >
              Atur jam makan &amp; riwayat lengkap →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationRow({ notification }: { notification: MealNotification }) {
  return (
    <li className={`px-4 py-3 ${notification.read ? "opacity-60" : ""}`}>
      <div className="flex items-center gap-2 mb-1">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${kindBg(
            notification.kind,
          )} ${kindColor(notification.kind)}`}
        >
          {kindLabel(notification.kind)}
        </span>
        {!notification.read && (
          <span className="w-1.5 h-1.5 rounded-full bg-energy" aria-hidden />
        )}
        <span className="ml-auto text-[10px] text-muted">
          {timeAgo(notification.at)}
        </span>
      </div>
      <p className="text-[13px] font-medium text-ink leading-snug">
        {notification.title}
      </p>
      <p className="text-xs text-muted leading-5 mt-0.5">{notification.body}</p>
    </li>
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

function BellIcon({ hasAlert }: { hasAlert: boolean }) {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      stroke={hasAlert ? "var(--color-energy)" : "currentColor"}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 8.5a6 6 0 1 0-12 0c0 6-2.3 7.5-2.3 7.5h16.6S18 14.5 18 8.5Z" />
      <path d="M9.5 19.5a2.5 2.5 0 0 0 5 0" />
    </svg>
  );
}