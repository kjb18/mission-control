import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchTopics } from "../lib/learningHub";
import TopicCard from "./learningHub/TopicCard";
import TopicFormModal from "./learningHub/TopicFormModal";
import LogSessionModal from "./learningHub/LogSessionModal";

export default function LearningHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formTopic, setFormTopic] = useState(null);
  const [sessionTopic, setSessionTopic] = useState(null);

  const highlightId = searchParams.get("topic");

  function load() {
    setLoading(true);
    fetchTopics()
      .then((data) => {
        setTopics(data);
        // Deep link from the homepage's Continue button.
        const target = data.find((t) => t.id === highlightId);
        if (target && searchParams.get("log") === "1") {
          setSessionTopic(target);
          setSearchParams({ topic: highlightId }, { replace: true });
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSaved() {
    setFormTopic(null);
    setSessionTopic(null);
    load();
  }

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-10 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-accent font-medium mb-1">Learning Hub</p>
          <h1 className="text-2xl font-semibold text-white">Learning Topics</h1>
          <p className="text-sm text-ink-secondary mt-1">Log a session to build your streak.</p>
        </div>
        <button
          onClick={() => setFormTopic({})}
          className="px-4 py-2 rounded-[10px] bg-accent hover:bg-accent-light text-base-950 text-sm font-semibold shrink-0"
        >
          + New Topic
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-400/10 border border-red-400/20 rounded-[10px] px-3 py-2">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {topics.map((t) => (
          <TopicCard
            key={t.id}
            topic={t}
            highlighted={t.id === highlightId}
            onLogSession={setSessionTopic}
            onEdit={setFormTopic}
          />
        ))}
        {!loading && topics.length === 0 && (
          <p className="text-sm text-ink-muted col-span-full text-center py-10">No topics yet.</p>
        )}
      </div>

      {formTopic !== null && (
        <TopicFormModal
          topic={formTopic.id ? formTopic : null}
          onClose={() => setFormTopic(null)}
          onSaved={handleSaved}
        />
      )}
      {sessionTopic && (
        <LogSessionModal topic={sessionTopic} onClose={() => setSessionTopic(null)} onSaved={handleSaved} />
      )}
    </div>
  );
}
