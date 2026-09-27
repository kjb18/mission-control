import { useEffect, useMemo, useState } from "react";
import { fetchArticles, fetchSeoTarget } from "../lib/seo";
import ArticleFormModal from "./seo/ArticleFormModal";
import { PageHeader, Card, Badge, Button, DataTable, EmptyState } from "../components/ui";

const STATUS_ORDER = { Published: 0, Scheduled: 1, Draft: 2 };
const STATUS_VARIANT = {
  Published: "green",
  Scheduled: "blue",
  Draft: "gray",
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

  const columns = [
    { key: "title", label: "Title" },
    { key: "target_keyword", label: "Keyword", render: (a) => a.target_keyword || "—" },
    {
      key: "status",
      label: (
        <span className="cursor-pointer hover:text-ink-secondary" onClick={() => setSortKey("status")}>
          Status {sortKey === "status" ? "↓" : ""}
        </span>
      ),
      render: (a) => <Badge variant={STATUS_VARIANT[a.status]}>{a.status}</Badge>,
    },
    {
      key: "publish_date",
      label: (
        <span className="cursor-pointer hover:text-ink-secondary" onClick={() => setSortKey("publish_date")}>
          Publish Date {sortKey === "publish_date" ? "↓" : ""}
        </span>
      ),
      render: (a) => a.publish_date || "—",
    },
    { key: "word_count", label: "Words", render: (a) => a.word_count ?? "—" },
    {
      key: "url",
      label: "URL",
      render: (a) =>
        a.url ? (
          <a href={a.url} target="_blank" rel="noreferrer" className="text-violet-600 hover:text-violet-700 text-xs">
            View ↗
          </a>
        ) : (
          "—"
        ),
    },
    {
      key: "edit",
      label: "",
      render: (a) => (
        <button onClick={() => setFormArticle(a)} className="text-xs text-ink-secondary hover:text-white">
          Edit
        </button>
      ),
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <PageHeader
        title="Article Tracker"
        action={
          <Button variant="primary" className="!bg-violet-600" onClick={() => setFormArticle({})}>
            + New Article
          </Button>
        }
      />

      <Card>
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
      </Card>

      {error && (
        <p className="text-sm text-red-600 bg-red-400/10 border border-red-400/20 rounded-[10px] px-3 py-2">
          {error}
        </p>
      )}

      {!loading && sorted.length === 0 ? (
        <Card>
          <EmptyState title="No articles yet" subtitle="Add your first tracked article." />
        </Card>
      ) : (
        <Card noPadding className="overflow-x-auto">
          <DataTable columns={columns} rows={sorted} />
        </Card>
      )}

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
