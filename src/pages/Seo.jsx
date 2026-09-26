import { useEffect, useMemo, useState } from "react";
import { fetchArticles, fetchSeoTarget } from "../lib/seo";
import ArticleFormModal from "./seo/ArticleFormModal";

const STATUS_ORDER = { Published: 0, Scheduled: 1, Draft: 2 };
const STATUS_STYLES = {
  Published: "text-emerald-700 bg-emerald-400/15",
  Scheduled: "text-blue-600 bg-blue-500/15",
  Draft: "text-ink-secondary bg-base-800/60",
};

export default function Seo() {
  const [articles, setArticles] = useState([]);
  const [target, setTarget] = useState(50);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortKey, setSortKey] = useState("status");
  const [formArticle, setFormArticle] = useState(null);

  function load() {
    setLoading(true);
    Promise.all([fetchArticles(), fetchSeoTarget()])
      .then(([a, t]) => {
        setArticles(a);
        setTarget(t);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  const publishedCount = articles.filter((a) => a.status === "Published").length;

  const sorted = useMemo(() => {
    return [...articles].sort((a, b) => {
      if (sortKey === "status") return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      // publish_date: nulls last, otherwise descending (most recent first)
      if (!a.publish_date && !b.publish_date) return 0;
      if (!a.publish_date) return 1;
      if (!b.publish_date) return -1;
      return b.publish_date.localeCompare(a.publish_date);
    });
  }, [articles, sortKey]);

  function handleSaved() {
    setFormArticle(null);
    load();
  }

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-10 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-violet-600 font-medium mb-1">SEO</p>
          <h1 className="text-2xl font-semibold text-white">Article Tracker</h1>
        </div>
        <button
          onClick={() => setFormArticle({})}
          className="px-4 py-2 rounded-[10px] bg-violet-600 hover:bg-violet-700 text-base-950 text-sm font-semibold shrink-0"
        >
          + New Article
        </button>
      </div>

      <div className="rounded-[10px] border-[0.5px] border-line bg-base-900 px-3 py-2.5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-ink-secondary">
            <span className="text-2xl font-semibold text-white">{publishedCount}</span> of {target} articles
            published
          </p>
          <span className="text-violet-600 font-medium">
            {Math.round((publishedCount / target) * 100)}%
          </span>
        </div>
        <div className="w-full h-2 rounded-full bg-base-800/60 overflow-hidden">
          <div
            className="h-full bg-violet-600"
            style={{ width: `${Math.min(100, (publishedCount / target) * 100)}%` }}
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-400/10 border border-red-400/20 rounded-[10px] px-3 py-2">
          {error}
        </p>
      )}

      <div className="rounded-[10px] border border-line bg-base-900 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-ink-secondary border-b border-line">
              <th className="py-3 px-4">Title</th>
              <th className="py-3 px-4">Keyword</th>
              <th className="py-3 px-4 cursor-pointer hover:text-ink-secondary" onClick={() => setSortKey("status")}>
                Status {sortKey === "status" ? "↓" : ""}
              </th>
              <th className="py-3 px-4 cursor-pointer hover:text-ink-secondary" onClick={() => setSortKey("publish_date")}>
                Publish Date {sortKey === "publish_date" ? "↓" : ""}
              </th>
              <th className="py-3 px-4">Words</th>
              <th className="py-3 px-4">URL</th>
              <th className="py-3 px-4" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((a) => (
              <tr key={a.id} className="border-b border-line">
                <td className="py-3 px-4 text-white">{a.title}</td>
                <td className="py-3 px-4 text-ink-secondary">{a.target_keyword || "—"}</td>
                <td className="py-3 px-4">
                  <span className={`text-[11px] font-medium rounded-full px-2 py-0.5 ${STATUS_STYLES[a.status]}`}>
                    {a.status}
                  </span>
                </td>
                <td className="py-3 px-4 text-ink-secondary">{a.publish_date || "—"}</td>
                <td className="py-3 px-4 text-ink-secondary">{a.word_count ?? "—"}</td>
                <td className="py-3 px-4">
                  {a.url ? (
                    <a href={a.url} target="_blank" rel="noreferrer" className="text-violet-600 hover:text-violet-700 text-xs">
                      View ↗
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="py-3 px-4">
                  <button onClick={() => setFormArticle(a)} className="text-xs text-ink-secondary hover:text-white">
                    Edit
                  </button>
                </td>
              </tr>
            ))}
            {!loading && sorted.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-sm text-ink-muted">
                  No articles yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {formArticle !== null && (
        <ArticleFormModal
          article={formArticle.id ? formArticle : null}
          onClose={() => setFormArticle(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
