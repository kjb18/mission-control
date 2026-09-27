import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchTopics } from "../lib/learningHub";
import TopicCard from "./learningHub/TopicCard";
import TopicFormModal from "./learningHub/TopicFormModal";
import LogSessionModal from "./learningHub/LogSessionModal";
import { PageHeader, Button, EmptyState } from "../components/ui";

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
    <div className="max-w-6xl mx-auto space-y-5">
      <PageHeader
        title="Learning Topics"
        subtitle="Log a session to build your streak."
        action={
          <Button variant="primary" onClick={() => setFormTopic({})}>
            + New Topic
          </Button>
        }
      />

      {error && (
        <p className="text-sm text-red-600 bg-red-400/10 border border-red-400/20 rounded-[10px] px-3 py-2">
          {error}
        </p>
      )}

      {!loading && topics.length === 0 ? (
        <EmptyState
          title="No topics yet"
          subtitle="Add a learning topic to start tracking your streak."
          ctaLabel="+ New Topic"
          onCta={() => setFormTopic({})}
        />
      ) : (
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
        </div>
      )}

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
