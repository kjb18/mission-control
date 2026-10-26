import { useEffect, useState } from "react";
import { fetchTargets } from "../lib/crosshairs";
import TargetCard from "./crosshairs/TargetCard";
import TargetFormModal from "./crosshairs/TargetFormModal";
import AddToCrosshairsModal from "./crosshairs/AddToCrosshairsModal";
import LogTouchpointModal from "./crosshairs/LogTouchpointModal";
import { PageHeader, Button, EmptyState } from "../components/ui";

export default function Crosshairs() {
  const [targets, setTargets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formTarget, setFormTarget] = useState(null); // null closed, target for edit
  const [adding, setAdding] = useState(false);
  const [touchpointTarget, setTouchpointTarget] = useState(null);

  function load() {
    setLoading(true);
    fetchTargets()
      .then(setTargets)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function handleSaved() {
    setFormTarget(null);
    setAdding(false);
    setTouchpointTarget(null);
    load();
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <PageHeader
        title="Target Accounts"
        subtitle="Sorted by priority, then by the most neglected last touchpoint first."
        action={
          <Button variant="primary" className="!bg-violet-600" onClick={() => setAdding(true)}>
            + Add to Crosshairs
          </Button>
        }
      />

      {error && (
        <p className="text-sm text-red-600 bg-red-400/10 border border-red-400/20 rounded-[10px] px-3 py-2">
          {error}
        </p>
      )}

      {!loading && targets.length === 0 ? (
        <EmptyState
          title="No targets yet"
          subtitle="Add a company to Crosshairs to start tracking touchpoints."
          ctaLabel="+ Add to Crosshairs"
          onCta={() => setAdding(true)}
          tone="purple"
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {targets.map((t) => (
            <TargetCard
              key={t.id}
              target={t}
              onLogTouchpoint={setTouchpointTarget}
              onEdit={setFormTarget}
            />
          ))}
        </div>
      )}

      {adding && <AddToCrosshairsModal onClose={() => setAdding(false)} onSaved={handleSaved} />}
      {formTarget !== null && (
        <TargetFormModal
          target={formTarget}
          onClose={() => setFormTarget(null)}
          onSaved={handleSaved}
        />
      )}
      {touchpointTarget && (
        <LogTouchpointModal
          target={touchpointTarget}
          onClose={() => setTouchpointTarget(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
