export default function Loading() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4 py-16">
      <span className="w-10 h-10 rounded-2xl bg-gradient-to-br from-brand to-hydration text-white flex items-center justify-center animate-pulse">
        🍃
      </span>
      <p className="text-sm text-muted">Sebentar, menyiapkan halaman…</p>
    </div>
  );
}