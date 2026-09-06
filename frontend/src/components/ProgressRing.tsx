import type { ReactNode } from "react";

/**
 * Donut chart SVG ringan (tanpa library eksternal).
 * Dipakai untuk ring kalori & hidrasi di dashboard dan catatan harian.
 *
 * Ada cakram lembut di tengah ring supaya angka di dalamnya selalu terbaca
 * jelas dan tidak pernah "tertimpa" oleh garis ring.
 */
export function ProgressRing({
  size = 150,
  stroke = 12,
  progress,
  color,
  children,
}: {
  size?: number;
  stroke?: number;
  progress: number;
  color: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, progress));
  const offset = circumference * (1 - clamped);
  const discR = Math.max(8, r - stroke - 2);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="var(--color-line)"
          strokeWidth={stroke}
          fill="none"
        />
        {/* Progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s ease" }}
        />
        {/* Cakram tengah: memisahkan angka dari ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={discR}
          fill="var(--color-surface)"
          stroke="rgba(216, 210, 196, 0.55)"
          strokeWidth={1}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-full max-w-[70%] text-center leading-none">
          {children}
        </div>
      </div>
    </div>
  );
}