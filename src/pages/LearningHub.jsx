import { Fragment, useCallback, useEffect, useState } from "react";
import "./LearningHub.css";
import {
  fetchTodayModule,
  fetchModuleHistory,
  logModuleSession,
  currentStreak,
  saveTopicRequest,
} from "../lib/learningModules";

// Daily Learning: a Claude-generated module each day (generate-learning-module
// Edge Function, stored in learning_hub_modules), its history, and a request
// box that steers the next module.

const TABS = [
  { key: "today", label: "Today's module" },
  { key: "history", label: "History" },
  { key: "request", label: "Request a topic" },
];

const CATEGORY_COLORS = {
  Sales: { bg: "#dbeafe", fg: "#1e40af" },
  Leadership: { bg: "#ede9fe", fg: "#5b21b6" },
  Strategy: { bg: "#fef3c7", fg: "#92400e" },
  Operations: { bg: "#d1fae5", fg: "#065f46" },
  Finance: { bg: "#ccfbf1", fg: "#115e59" },
  Mindset: { bg: "#ffedd5", fg: "#9a3412" },
};

const CONCEPT_COLORS = [
  { bg: "#dbeafe", fg: "#1e40af" },
  { bg: "#d1fae5", fg: "#065f46" },
  { bg: "#fef3c7", fg: "#92400e" },
  { bg: "#ede9fe", fg: "#5b21b6" },
  { bg: "#fee2e2", fg: "#991b1b" },
  { bg: "#f1f5f9", fg: "#475569" },
];

const initialOf = (m) => (m.cover_initial || m.book_title || "?").charAt(0).toUpperCase();

function todayLabel() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Manila",
  });
}

function ModuleView({ module }) {
  const cat = CATEGORY_COLORS[module.category] ?? CATEGORY_COLORS.Strategy;
  const concepts = Array.isArray(module.key_concepts) ? module.key_concepts : [];
  return (
    <div className="lh-stack">
      <div className="lh-card lh-top">
        <div className="lh-top-row">
          <div className="lh-cover" style={{ background: module.cover_color || "#3b82f6" }}>{initialOf(module)}</div>
          <div className="lh-top-main">
            <span className="lh-badge" style={{ background: cat.bg, color: cat.fg }}>{module.category}</span>
            <div className="lh-book">{module.book_title}</div>
            {module.book_source && <div className="lh-source">{module.book_source}</div>}
            {module.description && <div className="lh-desc">{module.description}</div>}
          </div>
        </div>
        <div className="lh-quote">
          <div className="lh-quote-text">“{module.quote}”</div>
          {module.quote_author && <div className="lh-quote-by">— {module.quote_author}</div>}
        </div>
      </div>

      <div className="lh-card">
        <div className="lh-label">Key concepts</div>
        <div className="lh-concepts">
          {concepts.map((c, i) => {
            const col = CONCEPT_COLORS[i % CONCEPT_COLORS.length];
            return (
              <div key={i} className="lh-concept" style={{ background: col.bg, color: col.fg }}>{c}</div>
            );
          })}
        </div>
      </div>

      <div className="lh-card">
        <div className="lh-label tight">Key takeaway</div>
        <div className="lh-body">{module.key_takeaway}</div>
      </div>

      <div className="lh-card lh-app">
        <div className="lh-label tight purple">Application for Ultra Power</div>
        <div className="lh-body">{module.application}</div>
      </div>
    </div>
  );
}

function TodayTab({ refreshSeq, onRefreshing }) {
  const [module, setModule] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState(null);
  const [logging, setLogging] = useState(false);
  const [logError, setLogError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const m = await fetchTodayModule();
      setModule(m);
      if (m.logged_today) setStreak(await currentStreak().catch(() => null));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Refresh button (in the tab bar): force a new module, keeping the current one
  // on screen until the replacement arrives.
  useEffect(() => {
    if (!refreshSeq) return;
    let cancelled = false;
    onRefreshing(true);
    setError(null);
    fetchTodayModule({ force: true })
      .then((m) => {
        if (cancelled) return;
        setModule(m);
        setLoading(false);
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && onRefreshing(false));
    return () => {
      cancelled = true;
    };
  }, [refreshSeq]); // eslint-disable-line react-hooks/exhaustive-deps

  const logSession = async () => {
    setLogging(true);
    setLogError(null);
    try {
      const n = await logModuleSession(module);
      setModule((m) => ({ ...m, logged_today: true }));
      setStreak(n);
    } catch (e) {
      setLogError(e.message);
    } finally {
      setLogging(false);
    }
  };

  if (loading) {
    return (
      <div className="lh-state">
        <div className="lh-spinner" />
        Preparing today's module…
      </div>
    );
  }
  if (error) {
    return (
      <div className="lh-state">
        <div className="lh-error">Couldn't load today's module: {error}</div>
        <button className="lh-retry" onClick={load}>Retry</button>
      </div>
    );
  }

  return (
    <div className="lh-stack">
      <ModuleView module={module} />
      {module.logged_today ? (
        <button className="lh-log done" disabled>
          ✓ Session logged{streak != null ? ` — streak: ${streak} day${streak === 1 ? "" : "s"}` : ""}
        </button>
      ) : (
        <button className="lh-log" onClick={logSession} disabled={logging}>
          {logging ? "Logging…" : "Log Session"}
        </button>
      )}
      {logError && <div className="lh-msg err">{logError}</div>}
    </div>
  );
}

function HistoryTab() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(null);

  useEffect(() => {
    fetchModuleHistory().then(setRows).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (error) return <div className="lh-state lh-error">{error}</div>;
  if (!rows) return <div className="lh-state"><div className="lh-spinner" /></div>;
  if (!rows.length) return <div className="lh-state">No modules yet. Today's will appear here once it's generated.</div>;

  return (
    <>
      <div className="lh-card" style={{ padding: "4px 16px" }}>
        {rows.map((m) => (
          <div key={m.id} className="lh-row" onClick={() => setOpen(m)}>
            <div className="lh-thumb" style={{ background: m.cover_color || "#3b82f6" }}>{initialOf(m)}</div>
            <div className="lh-row-main">
              <div className="lh-row-title">{m.book_title}</div>
              <div className="lh-row-meta">{m.category}</div>
            </div>
            {m.logged_today && <span className="lh-check" title="Session logged">✓</span>}
            <div className="lh-row-date">{m.generated_date}</div>
          </div>
        ))}
      </div>
      {open && (
        <div className="lh-modal" onMouseDown={(e) => e.target === e.currentTarget && setOpen(null)}>
          <div className="lh-modal-box" role="dialog" aria-label={open.book_title}>
            <div className="lh-modal-head">
              <span>{open.generated_date}</span>
              <button className="lh-close" onClick={() => setOpen(null)} aria-label="Close">✕</button>
            </div>
            <ModuleView module={open} />
          </div>
        </div>
      )}
    </>
  );
}

function RequestTab() {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const save = async () => {
    if (!text.trim()) return;
    setSaving(true);
    setMsg(null);
    try {
      await saveTopicRequest(text.trim());
      setText("");
      setMsg({ ok: true, text: "Request saved. Tomorrow's module will be based on your request." });
    } catch (e) {
      setMsg({ ok: false, text: `Couldn't save the request: ${e.message}` });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="lh-card">
      <div className="lh-label tight">Request tomorrow's topic</div>
      <div className="lh-desc-sm">
        Enter a book title, author, concept, or any topic. Your request will be used to generate tomorrow's module.
      </div>
      <textarea
        className="lh-textarea"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="e.g. The 48 Laws of Power by Robert Greene, or a deep dive on pricing strategy for B2B…"
      />
      <button className="lh-save" onClick={save} disabled={saving || !text.trim()}>
        {saving ? "Saving…" : "Save request"}
      </button>
      {msg && <div className={`lh-msg ${msg.ok ? "ok" : "err"}`}>{msg.text}</div>}
    </div>
  );
}

export default function LearningHub() {
  const [tab, setTab] = useState("today");
  const [refreshSeq, setRefreshSeq] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  return (
    <div className="lh-page">
      <div className="lh-head">
        <div>
          <h1 className="lh-title">Daily Learning</h1>
          <div className="lh-date">{todayLabel()}</div>
        </div>
        <div className="lh-tabs" role="tablist">
          {TABS.map((t) => (
            <Fragment key={t.key}>
              <button
                role="tab"
                aria-selected={tab === t.key}
                className={`lh-tab${tab === t.key ? " on" : ""}`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
              {t.key === "today" && (
                <button
                  className="lh-refresh"
                  title="Generate a new module for today"
                  aria-label="Generate a new module for today"
                  disabled={refreshing}
                  onClick={() => {
                    setTab("today");
                    setRefreshSeq((n) => n + 1);
                  }}
                >
                  {refreshing ? (
                    <span className="lh-refresh-spin" />
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                      <path d="M21 3v6h-6" />
                    </svg>
                  )}
                </button>
              )}
            </Fragment>
          ))}
        </div>
      </div>

      {/* Today and Request stay mounted so switching back is instant; History
          refetches each time it opens so newly logged sessions show. */}
      <div hidden={tab !== "today"}><TodayTab refreshSeq={refreshSeq} onRefreshing={setRefreshing} /></div>
      <div hidden={tab !== "history"}>{tab === "history" && <HistoryTab />}</div>
      <div hidden={tab !== "request"}><RequestTab /></div>
    </div>
  );
}
