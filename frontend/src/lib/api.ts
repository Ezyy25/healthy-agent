const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

/**
 * Custom error supaya komponen bisa membedakan error validasi (422)
 * dari error lain, dan menampilkan pesan yang tepat ke user.
 */
export class ApiError extends Error {
  status: number;
  errors?: Record<string, string[]>;

  constructor(message: string, status: number, errors?: Record<string, string[]>) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

/**
 * Wrapper fetch terpusat. Semua request API lewat sini supaya:
 * - Base URL & header konsisten di satu tempat
 * - Token otomatis disisipkan kalau ada
 * - Error format Laravel (422 validation, 401 auth) ditangani seragam
 */
async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(options.headers as Record<string, string>),
  };

  // Jangan set Content-Type kalau body-nya FormData (upload file),
  // browser perlu set boundary multipart secara otomatis.
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  const contentType = res.headers.get("content-type");
  const isJson = contentType?.includes("application/json");
  const data = isJson ? await res.json() : null;

  if (!res.ok) {
    throw new ApiError(
      data?.message ?? `Request gagal (${res.status})`,
      res.status,
      data?.errors
    );
  }

  return data as T;
}

export const api = {
  get: <T>(path: string, token?: string | null) =>
    apiFetch<T>(path, { method: "GET" }, token),

  post: <T>(path: string, body?: unknown, token?: string | null) =>
    apiFetch<T>(
      path,
      {
        method: "POST",
        body: body instanceof FormData ? body : JSON.stringify(body ?? {}),
      },
      token
    ),

  put: <T>(path: string, body?: unknown, token?: string | null) =>
    apiFetch<T>(
      path,
      {
        method: "PUT",
        body: body instanceof FormData ? body : JSON.stringify(body ?? {}),
      },
      token
    ),
};
