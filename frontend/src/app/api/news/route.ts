import { NextResponse } from "next/server";

export interface NewsArticle {
  title: string;
  description: string | null;
  url: string;
  imageUrl: string | null;
  source: string;
  publishedAt: string;
}

// Route ini berjalan di server Next.js, bukan di browser — jadi
// NEWS_API_KEY (tanpa prefix NEXT_PUBLIC_) aman, tidak pernah terlihat
// oleh pengunjung website. Browser cuma manggil /api/news di sini.
export async function GET() {
  const apiKey = process.env.NEWS_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "NEWS_API_KEY belum diset di .env.local" },
      { status: 500 },
    );
  }

  const params = new URLSearchParams({
    q: "pola hidup sehat OR gizi OR nutrisi OR olahraga",
    language: "id",
    sortBy: "publishedAt",
    pageSize: "6",
    apiKey,
  });

  try {
    const res = await fetch(`https://newsapi.org/v2/everything?${params}`, {
      // Cache 24 jam — berita "ganti tiap hari", dan hemat jatah
      // 100 request/hari dari paket gratis NewsAPI.
      next: { revalidate: 86400 },
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: data.message ?? "Gagal mengambil berita." },
        { status: res.status },
      );
    }

    interface RawArticle {
      title: string;
      description: string | null;
      url: string;
      urlToImage: string | null;
      source: { name: string };
      publishedAt: string;
    }

    const articles: NewsArticle[] = (data.articles as RawArticle[]).map(
      (a) => ({
        title: a.title,
        description: a.description,
        url: a.url,
        imageUrl: a.urlToImage,
        source: a.source.name,
        publishedAt: a.publishedAt,
      }),
    );

    return NextResponse.json({ articles });
  } catch {
    return NextResponse.json(
      { error: "Gagal menghubungi layanan berita." },
      { status: 502 },
    );
  }
}
