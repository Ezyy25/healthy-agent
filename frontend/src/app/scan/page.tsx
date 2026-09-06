"use client";

import { useEffect, useRef, useState, ChangeEvent, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useMealSchedule } from "@/context/MealScheduleContext";
import { api, ApiError } from "@/lib/api";
import { FoodItem, MineralEntry, MineralType } from "@/lib/types";
import { Navbar } from "@/components/Navbar";

const CAMERA_SUPPORTED =
  typeof navigator !== "undefined" &&
  typeof navigator.mediaDevices?.getUserMedia === "function";

const MINERAL_KEYS: Array<{
  type: MineralType;
  field: keyof NonNullable<FoodItem["micronutrients"]>;
}> = [
  { type: "natrium", field: "natrium_mg" },
  { type: "kalium", field: "kalium_mg" },
  { type: "magnesium", field: "magnesium_mg" },
];

function pushScanMinerals(userId: number, foodItem: FoodItem) {
  if (typeof window === "undefined" || !foodItem.micronutrients) return;

  try {
    const key = `healthy_agent_mineral_entries_${userId}`;
    const raw = localStorage.getItem(key);
    const existing = raw ? (JSON.parse(raw) as MineralEntry[]) : [];
    const entries = Array.isArray(existing) ? existing : [];
    const consumedAt = foodItem.created_at || new Date().toISOString();
    const additions = MINERAL_KEYS.flatMap(({ type, field }) => {
      const amount = Number(foodItem.micronutrients?.[field]);
      if (!Number.isFinite(amount) || amount <= 0) return [];
      const id = `scan-${foodItem.id}-${type}`;
      if (entries.some((entry) => entry.id === id)) return [];
      return [
        {
          id,
          type,
          amount_mg: Math.round(amount),
          source: `${foodItem.food_name} (hasil scan)`,
          consumed_at: consumedAt,
        } satisfies MineralEntry,
      ];
    });

    if (additions.length > 0) {
      localStorage.setItem(
        key,
        JSON.stringify([...additions, ...entries].slice(0, 50)),
      );
    }
  } catch {
    // Gagal menyimpan mineral lokal tidak boleh menggagalkan log makanan.
  }
}

export default function ScanPage() {
  const { user, token, isLoading } = useAuth();
  const meal = useMealSchedule();
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FoodItem | null>(null);

  // Status kamera live.
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraBusy, setCameraBusy] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!isLoading && !user) router.push("/login");
  }, [isLoading, user, router]);

  // Hentikan kamera & bersihkan preview saat halaman ditutup.
  useEffect(() => {
    return () => {
      stopStream();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewUrl]);

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOn(false);
  }

  async function startCamera() {
    if (!CAMERA_SUPPORTED) {
      setCameraError(
        "Kamera tidak didukung di perangkat ini. Pilih foto dari galeri saja.",
      );
      return;
    }
    setCameraError(null);
    setCameraBusy(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOn(true);
      // Pasang stream ke elemen video setelah render.
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      setCameraError(
        name === "NotAllowedError" || name === "SecurityError"
          ? "Izin kamera ditolak. Izinkan akses kamera lalu coba lagi."
          : "Tidak bisa membuka kamera. Pilih foto dari galeri saja.",
      );
    } finally {
      setCameraBusy(false);
    }
  }

  function capturePhoto() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setCameraError("Gagal mengambil foto. Coba lagi.");
          return;
        }
        const captured = new File([blob], `scan-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        setFile(captured);
        setPreviewUrl(URL.createObjectURL(captured));
        setResult(null);
        setError(null);
        stopStream();
      },
      "image/jpeg",
      0.92,
    );
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setResult(null);
    setError(null);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(selected);
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file || !token || !user) return;

    setError(null);
    setIsScanning(true);

    try {
      const formData = new FormData();
      formData.append("image", file);
      const foodItem = await api.post<FoodItem>(
        "/v1/food/scan",
        formData,
        token,
      );
      localStorage.setItem("healthy_agent_last_scan", JSON.stringify(foodItem));
      pushScanMinerals(user.id, foodItem);
      setResult(foodItem);
      // Foto yang berhasil di-scan otomatis mengonfirmasi waktu makan
      // yang sedang berlangsung (pagi/siang/sore). Bukan lewat tombol.
      meal.confirmMealFromActivity(
        foodItem.created_at ?? new Date().toISOString(),
        foodItem.source_type,
      );
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Gagal memindai foto. Coba lagi.",
      );
    } finally {
      setIsScanning(false);
    }
  }

  function reset() {
    stopStream();
    setFile(null);
    setPreviewUrl(null);
    setResult(null);
    setError(null);
  }

  if (isLoading || !user) {
    return (
      <main className="flex-1 flex items-center justify-center px-4">
        <p className="soft-chip">Memuat scanner sehat…</p>
      </main>
    );
  }

  return (
    <>
      <Navbar />
      <main className="flex-1 max-w-md mx-auto w-full px-4 pt-6 pb-12">
        {/* Header */}
        <section className="surface-card p-5 mb-5">
          <span className="soft-chip inline-flex">📷 Scan Makanan</span>
          <h1 className="section-title text-2xl mt-3">Scan Foto Makanan</h1>
          <p className="text-sm text-muted mt-2 leading-6">
            Buka kamera atau pilih foto, AI baca kalori &amp; makro otomatis.
          </p>
        </section>
        {result ? (
          <ScanResult result={result} onScanAgain={reset} />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Area kamera live / preview */}
            {cameraOn ? (
              <div className="surface-card overflow-hidden">
                <div className="relative">
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full aspect-square object-cover"
                  />
                  <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="w-[76%] aspect-[4/3] border-2 border-dashed border-white/80 rounded-3xl" />
                  </span>
                </div>
                <div className="p-4 flex gap-3">
                  <button
                    type="button"
                    onClick={capturePhoto}
                    className="flex-1 rounded-2xl bg-brand text-white py-3 text-sm font-semibold hover:bg-brand-dark transition"
                  >
                    📸 Ambil Foto
                  </button>
                  <button
                    type="button"
                    onClick={() => stopStream()}
                    className="flex-1 rounded-2xl border border-line/80 py-3 text-sm font-semibold text-ink hover:bg-paper/70 transition"
                  >
                    Batal
                  </button>
                </div>
              </div>
            ) : previewUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Preview foto makanan"
                  className="w-full aspect-square object-cover rounded-3xl border border-line"
                />
                <button
                  type="button"
                  onClick={reset}
                  className="w-full rounded-2xl border border-line/80 py-2.5 text-sm font-semibold text-ink hover:bg-paper/70 transition"
                >
                  Ganti foto
                </button>
              </>
            ) : (
              /* Mode pemilihan: kamera langsung atau galeri */
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={startCamera}
                  disabled={cameraBusy}
                  className="w-full rounded-3xl bg-gradient-to-r from-brand to-brand-dark text-white py-4 text-sm font-semibold shadow-[0_12px_26px_rgba(31,110,74,0.3)] hover:-translate-y-0.5 disabled:opacity-60 transition"
                >
                  {cameraBusy ? "Membuka kamera…" : "📸 Buka Kamera"}
                </button>

                <label className="flex items-center justify-center gap-2 w-full rounded-2xl border-2 border-dashed border-line bg-surface px-4 py-4 text-sm font-medium text-muted cursor-pointer hover:border-brand/40 hover:text-brand transition">
                  🖼️ Pilih dari galeri
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileChange}
                    className="sr-only"
                  />
                </label>
              </div>
            )}

            {cameraError && (
              <p className="text-sm text-energy bg-energy-soft/80 px-4 py-3 rounded-2xl">
                {cameraError}
              </p>
            )}
            {error && (
              <p className="text-sm text-energy bg-energy-soft/80 px-4 py-3 rounded-2xl">
                {error}
              </p>
            )}

            {file && !result && (
              <button
                type="submit"
                disabled={isScanning}
                className="w-full rounded-2xl bg-ink text-white py-3.5 text-sm font-semibold hover:bg-ink/85 disabled:opacity-50 transition"
              >
                {isScanning ? "Menganalisis foto (AI)…" : "🔍 Scan Foto"}
              </button>
            )}

            {isScanning && (
              <p className="text-xs text-muted text-center leading-5">
                AI vision sedang membaca foto. Ini bisa makan waktu 10–20 detik,
                mohon tunggu.
              </p>
            )}
          </form>
        )}
      </main>
    </>
  );
}
function ScanResult({
  result,
  onScanAgain,
}: {
  result: FoodItem;
  onScanAgain: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="surface-card overflow-hidden">
        {result.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={result.image_url}
            alt={result.food_name}
            className="w-full aspect-square object-cover"
          />
        )}
        <div className="p-5">
          <p className="text-xs text-brand font-medium mb-1">Terdeteksi AI</p>
          <h2 className="section-title text-lg mb-4">{result.food_name}</h2>

          <div className="grid grid-cols-4 gap-3 text-center">
            <NutrientStat label="Kalori" value={result.calories} unit="kkal" />
            <NutrientStat
              label="Karbo"
              value={Number(result.carbs_g)}
              unit="g"
            />
            <NutrientStat
              label="Protein"
              value={Number(result.protein_g)}
              unit="g"
            />
            <NutrientStat label="Lemak" value={Number(result.fat_g)} unit="g" />
          </div>
          {result.micronutrients && (
            <div className="mt-5 rounded-2xl bg-hydration-soft/60 border border-hydration/20 p-3">
              <p className="text-xs font-semibold text-hydration mb-2">
                Mineral otomatis ditambahkan
              </p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <MineralStat
                  label="Natrium"
                  value={result.micronutrients.natrium_mg}
                />
                <MineralStat
                  label="Kalium"
                  value={result.micronutrients.kalium_mg}
                />
                <MineralStat
                  label="Magnesium"
                  value={result.micronutrients.magnesium_mg}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="text-sm text-muted text-center">
        Tersimpan otomatis ke catatan hari ini — waktu makan yang sedang
        berlangsung ikut terkonfirmasi.
      </p>

      <div className="flex gap-3">
        <button
          onClick={onScanAgain}
          className="flex-1 rounded-2xl border border-line/80 text-ink py-3 text-sm font-semibold hover:bg-paper/70 transition"
        >
          Scan Lagi
        </button>
        <Link
          href="/nutrition"
          className="flex-1 text-center rounded-2xl bg-brand text-white py-3 text-sm font-semibold hover:bg-brand-dark transition"
        >
          Lihat Catatan
        </Link>
      </div>
    </div>
  );
}

function NutrientStat({
  label,
  value,
  unit,
}: {
  label: string;
  value: number;
  unit: string;
}) {
  return (
    <div className="rounded-2xl bg-paper/70 border border-line/60 py-3">
      <p className="text-sm font-semibold text-ink">
        {value.toFixed(0)}
        <span className="text-xs font-normal text-muted ml-0.5">{unit}</span>
      </p>
      <p className="text-xs text-muted mt-0.5">{label}</p>
    </div>
  );
}

function MineralStat({ label, value }: { label: string; value?: number }) {
  return (
    <div>
      <p className="tabular text-sm font-semibold text-ink">
        {typeof value === "number" && value > 0
          ? `${Math.round(value)} mg`
          : "—"}
      </p>
      <p className="text-[10px] text-muted">{label}</p>
    </div>
  );
}
