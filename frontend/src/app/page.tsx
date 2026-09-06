"use client";

import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import type { NewsArticle } from "./api/news/route";

export default function Home() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [isLoadingNews, setIsLoadingNews] = useState(true);
  const [newsError, setNewsError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/news")
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setNewsError(data.error);
        } else {
          setArticles(data.articles ?? []);
        }
      })
      .catch(() => setNewsError("Gagal memuat berita."))
      .finally(() => setIsLoadingNews(false));
  }, []);

  return (
    <main className="flex-1 flex flex-col">
      <Navbar />

      {/* Hero */}
      <div className="max-w-3xl mx-auto w-full px-4 py-14 text-center">
        <span className="soft-chip mb-5 inline-flex">🌿 Asisten kesehatan AI</span>
        <h1 className="font-display font-semibold text-3xl md:text-5xl text-ink leading-[1.15] mb-4 max-w-xl mx-auto">
          Catat makan, pahami tubuhmu.
        </h1>
        <p className="text-base text-muted max-w-md mx-auto leading-relaxed">
          Foto makananmu, AI hitung kalorinya. Isi profil sekali, kami hitung
          kebutuhan kalori harianmu secara otomatis.
        </p>
      </div>

      {/* Feed berita */}
      <div className="max-w-3xl mx-auto w-full px-4 pb-16">
        <div className="flex items-baseline justify-between mb-4">
          <p className="section-title text-sm">Berita &amp; Tips Hidup Sehat</p>
          <span className="text-xs text-muted">Diperbarui tiap hari</span>
        </div>

        {isLoadingNews ? (
          <p className="text-sm text-muted py-6">Memuat berita…</p>
        ) : newsError ? (
          <p className="text-sm text-muted py-6">
            Berita belum bisa ditampilkan saat ini.
          </p>
        ) : articles.length === 0 ? (
          <p className="text-sm text-muted py-6">Belum ada berita terbaru.</p>
        ) : (
          <div className="space-y-4">
            {articles.map((article) => (
              <NewsCard key={article.url} article={article} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function NewsCard({ article }: { article: NewsArticle }) {
  return (
    <article className="surface-card p-4 flex flex-col sm:flex-row gap-3 sm:items-start">
      {article.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={article.imageUrl}
          alt=""
          className="w-full sm:w-24 h-36 sm:h-20 object-cover rounded-2xl shrink-0"
        />
      ) : (
        <span className="hidden sm:flex w-24 h-20 rounded-2xl bg-gradient-to-br from-brand/10 to-energy/10 items-center justify-center text-2xl shrink-0">
          🥗
        </span>
      )}
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-xs text-muted mb-1.5">
          <span className="soft-chip">{article.source}</span>
          <span>
            {new Date(article.publishedAt).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "short",
            })}
          </span>
        </div>
        <p className="text-sm font-medium text-ink leading-snug">
          {article.title}
        </p>
        {article.description && (
          <p className="text-xs text-muted leading-5 mt-1.5 line-clamp-2">
            {article.description}
          </p>
        )}
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-xs text-brand font-medium mt-2 hover:underline"
        >
          Baca artikel lengkap →
        </a>
      </div>
    </article>
  );
}
