"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth, ApiError } from "@/context/AuthContext";
import { Button } from "@/components/Button";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.errors?.email?.[0] ?? err.message);
      } else {
        setError("Terjadi kesalahan. Coba lagi.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm surface-card p-6 sm:p-7">
        <div className="mb-6">
          <span className="soft-chip mb-4">Healthy Agent</span>
          <h1 className="section-title text-3xl mb-2 leading-tight">
            Selamat datang kembali
          </h1>
          <p className="text-sm text-muted leading-6">
            Masuk untuk lanjutkan catatan makan, air, dan target sehatmu.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <p className="text-sm text-energy bg-energy-soft/80 px-3 py-2 rounded-2xl">
              {error}
            </p>
          )}

          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="field-input"
            />
          </Field>

          <Field label="Password">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="field-input"
            />
          </Field>

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Memproses…" : "Masuk"}
          </Button>
        </form>

        <p className="text-sm text-muted mt-6 text-center">
          Belum punya akun?{" "}
          <Link href="/register" className="text-brand font-medium">
            Daftar
          </Link>
        </p>
      </div>
    </main>
  );
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
