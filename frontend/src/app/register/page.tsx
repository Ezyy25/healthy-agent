"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth, ApiError } from "@/context/AuthContext";
import { Button } from "@/components/Button";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== passwordConfirmation) {
      setError("Konfirmasi password tidak cocok.");
      return;
    }

    setIsSubmitting(true);
    try {
      await register(name, email, password, passwordConfirmation);
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
            Mulai hidup sehatmu
          </h1>
          <p className="text-sm text-muted leading-6">
            Daftar gratis untuk mencatat makan, minum, dan memantau target
            kalori harianmu.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <p className="text-sm text-energy bg-energy-soft/80 px-3 py-2 rounded-2xl">
              {error}
            </p>
          )}

          <Field label="Nama lengkap">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
              className="field-input"
            />
          </Field>

          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="field-input"
            />
          </Field>

          <Field label="Password">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="field-input"
            />
          </Field>

          <Field label="Konfirmasi password">
            <input
              type="password"
              value={passwordConfirmation}
              onChange={(e) => setPasswordConfirmation(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="field-input"
            />
          </Field>

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Mendaftarkan…" : "Daftar"}
          </Button>
        </form>

        <p className="text-sm text-muted mt-6 text-center">
          Sudah punya akun?{" "}
          <Link href="/login" className="text-brand font-medium">
            Masuk
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