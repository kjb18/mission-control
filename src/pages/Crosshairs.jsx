import { useEffect, useState } from "react";
import { fetchTargets } from "../lib/crosshairs";
import TargetCard from "./crosshairs/TargetCard";
import TargetFormModal from "./crosshairs/TargetFormModal";
import LogTouchpointModal from "./crosshairs/LogTouchpointModal";

export default function Crosshairs() {
  const [targets, setTargets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formTarget, setFormTarget] = useState(null); // null closed, {} for create, target for edit
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
    setTouchpointTarget(null);
    load();
  }

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-10 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-violet-600 font-medium mb-1">Crosshairs</p>
          <h1 className="text-2xl font-semibold text-white">Target Accounts</h1>
          <p className="text-sm text-ink-secondary mt-1">
            Sorted by priority, then by the most neglected last touchpoint first.
          </p>
        </div>
        <button
          onClick={() => setFormTarget({})}
          className="px-4 py-2 rounded-[10px] bg-violet-600 hover:bg-violet-700 text-base-950 text-sm font-semibold shrink-0"
        >
          + New Target
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-400/10 border border-red-400/20 rounded-[10px] px-3 py-2">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {targets.map((t) => (
          <TargetCard
            key={t.id}
            target={t}
            onLogTouchpoint={setTouchpointTarget}
            onEdit={setFormTarget}
          />
        ))}
        {!loading && targets.length === 0 && (
          <p className="text-sm text-ink-muted col-span-full text-center py-10">
            No targets yet — add your first one.
          </p>
        )}
      </div>

      {formTarget !== null && (
        <TargetFormModal
          target={formTarget.id ? formTarget : null}
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
