"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { MealBell } from "@/components/MealBell";

/**
 * Navigasi atas (top navbar) bergaya glassmorphism — khas aplikasi kesehatan.
 * Menampilkan brand, tautan cepat ke Profil / Catatan Harian / Scan Makanan /
 * Jam Makan, lonceng notifikasi, avatar user + tombol keluar.
 * Status aktif mengikuti route yang dibuka.
 */
export function Navbar() {
  const pathname = usePathname();
  const { user, isLoading, logout } = useAuth();

  const firstName = user?.name?.trim().split(/\s+/)[0] ?? "Sobat Sehat";
  const initials = (user?.name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  return (
    <header className="sticky top-0 z-30">
      <div className="max-w-5xl mx-auto px-3 sm:px-4">
        <div className="mt-3 mb-2 sm:mb-3 surface-card rounded-3xl px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2">
          {/* Brand */}
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 group min-w-0"
          >
            <span className="w-9 h-9 shrink-0 rounded-2xl bg-gradient-to-br from-brand to-brand-dark text-white flex items-center justify-center shadow-[0_8px_20px_rgba(31,110,74,0.3)] group-hover:scale-105 transition duration-200">
              <LeafIcon />
            </span>
            <span className="font-display font-semibold text-sm tracking-tight leading-none">
              Healthy<span className="text-brand"> Agent</span>
            </span>
          </Link>

          {/* Tautan navigasi */}
          <nav className="flex items-center gap-0.5 sm:gap-1">
            {NAV_LINKS.map(({ href, label, short, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-1.5 rounded-2xl px-2 sm:px-3 py-2 text-[12px] sm:text-[13px] font-medium transition duration-200 ${
                    active
                      ? "bg-brand/10 text-brand shadow-[inset_0_0_0_1px_rgba(31,110,74,0.14)]"
                      : "text-muted hover:bg-paper/80 hover:text-ink"
                  }`}
                >
                  <Icon active={active} />
                  <span className="hidden sm:inline">{label}</span>
                  <span className="sm:hidden">{short}</span>
                </Link>
              );
            })}
          </nav>

          {/* User / aksi masuk */}
          <div className="flex items-center gap-1.5">
            {!isLoading && !user ? (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="rounded-2xl px-3 py-2 text-[13px] font-medium text-ink hover:bg-paper/80 transition"
                >
                  Masuk
                </Link>
                <Link
                  href="/register"
                  className="hidden sm:block rounded-2xl bg-brand text-white px-3.5 py-2 text-[13px] font-semibold shadow-[0_8px_20px_rgba(31,110,74,0.25)] hover:bg-brand-dark transition"
                >
                  Daftar
                </Link>
              </div>
            ) : (
              <>
                <MealBell />
                <Link
                  href="/profile"
                  className="flex items-center gap-2 rounded-2xl py-1 pl-1 pr-2 hover:bg-paper/80 transition"
                  title="Buka profil"
                >
                  <span className="w-8 h-8 rounded-full bg-gradient-to-br from-energy to-energy/70 text-white flex items-center justify-center font-display text-xs font-bold">
                    {initials || "🍃"}
                  </span>
                  <span className="hidden md:block text-[13px] font-medium max-w-[7rem] truncate">
                    {firstName}
                  </span>
                </Link>
                <button
                  onClick={() => logout()}
                  title="Keluar"
                  className="w-8 h-8 rounded-2xl flex items-center justify-center text-muted hover:text-energy hover:bg-energy-soft/70 transition"
                >
                  <LogoutIcon />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

const NAV_LINKS = [
  { href: "/profile", label: "Profil", short: "Profil", icon: ProfileIcon },
  {
    href: "/nutrition",
    label: "Catatan Harian",
    short: "Catatan",
    icon: LogIcon,
  },
  {
    href: "/riwayat-kesehatan",
    label: "Riwayat",
    short: "Riwayat",
    icon: HistoryIcon,
  },
  { href: "/scan", label: "Scan Makanan", short: "Scan", icon: ScanIcon },
  { href: "/jadwal-makan", label: "Jam Makan", short: "Jam", icon: ClockIcon },
];

function HistoryIcon({ active }: { active?: boolean }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 12a8 8 0 1 0 2.35-5.65L4 8.7M4 4v4.7h4.7"
        stroke={navStroke(active)}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 8v4l2.5 1.5"
        stroke={navStroke(active)}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function navStroke(active?: boolean) {
  return active ? "var(--color-brand)" : "currentColor";
}

function LeafIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 19c8 0 14-4 14-13-9 0-14 4-14 13Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M5 19c2.5-5.5 6-9 11-11"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ProfileIcon({ active }: { active?: boolean }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle
        cx="12"
        cy="8"
        r="3.5"
        stroke={navStroke(active)}
        strokeWidth="1.8"
      />
      <path
        d="M4.5 20c1.2-3.8 4.2-6 7.5-6s6.3 2.2 7.5 6"
        stroke={navStroke(active)}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LogIcon({ active }: { active?: boolean }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="4.5"
        y="3.5"
        width="15"
        height="17"
        rx="1"
        stroke={navStroke(active)}
        strokeWidth="1.8"
      />
      <path
        d="M8 8h8M8 12h8M8 16h5"
        stroke={navStroke(active)}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ScanIcon({ active }: { active?: boolean }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16"
        stroke={navStroke(active)}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle
        cx="12"
        cy="12"
        r="3"
        stroke={navStroke(active)}
        strokeWidth="1.8"
      />
    </svg>
  );
}

function ClockIcon({ active }: { active?: boolean }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle
        cx="12"
        cy="12"
        r="8"
        stroke={navStroke(active)}
        strokeWidth="1.8"
      />
      <path
        d="M12 7v5l3.5 2"
        stroke={navStroke(active)}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 21H5.5A1.5 1.5 0 0 1 4 19.5v-15A1.5 1.5 0 0 1 5.5 3H9M15 16l4-4-4-4M19 12H9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
