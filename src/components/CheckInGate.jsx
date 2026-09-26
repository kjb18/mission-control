import { useState } from "react";
import { useCheckIn } from "../lib/CheckInContext";

const ENERGY_LEVELS = [
  { value: 1, label: "Depleted", emoji: "🪫" },
  { value: 2, label: "Low", emoji: "😴" },
  { value: 3, label: "Steady", emoji: "🙂" },
  { value: 4, label: "Strong", emoji: "💪" },
  { value: 5, label: "Peak", emoji: "🔥" },
];

const FEELING_CHIPS = [
  "Focused",
  "Anxious",
  "Motivated",
  "Tired",
  "Calm",
  "Overwhelmed",
  "Optimistic",
  "Restless",
  "Grateful",
  "Determined",
];

export default function CheckInGate() {
  const { isOpen, todayLog, isComplete, submit, closeGate } = useCheckIn();
  const [energyLevel, setEnergyLevel] = useState(todayLog?.energy_level ?? null);
  const [feeling, setFeeling] = useState(todayLog?.feeling ?? "");
  const [customFeeling, setCustomFeeling] = useState("");
  const [gratitude, setGratitude] = useState(todayLog?.gratitude ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const effectiveFeeling = feeling === "__custom__" ? customFeeling.trim() : feeling;
  const canUnlock = energyLevel && effectiveFeeling && gratitude.trim().length > 0;

  async function handleUnlock() {
    if (!canUnlock) return;
    setSubmitting(true);
    setError("");
    try {
      await submit({
        energyLevel,
        feeling: effectiveFeeling,
        gratitude: gratitude.trim(),
        mits: todayLog?.mits ?? [],
      });
    } catch (e) {
      setError(e.message ?? "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-base-950/95 backdrop-blur-sm px-4 py-8 overflow-y-auto">
      <div className="w-full max-w-lg">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs uppercase tracking-widest text-accent font-medium">
              Daily Check-In
            </p>
            <h1 className="text-2xl font-semibold text-white mt-1">
              Set the tone for today
            </h1>
          </div>
          {isComplete && (
            <button
              onClick={closeGate}
              className="text-ink-secondary hover:text-white text-sm"
            >
              Close
            </button>
          )}
        </div>

        <div className="bg-base-900 border border-line rounded-[10px] p-6 space-y-6">
          {/* Energy selector */}
          <div>
            <label className="block text-sm font-medium text-white mb-3">
              Energy level
            </label>
            <div className="grid grid-cols-5 gap-2">
              {ENERGY_LEVELS.map((level) => (
                <button
                  key={level.value}
                  type="button"
                  onClick={() => setEnergyLevel(level.value)}
                  className={`flex flex-col items-center gap-1 rounded-[10px] py-3 border transition-colors ${
                    energyLevel === level.value
                      ? "bg-accent/20 border-accent text-white"
                      : "bg-base-800 border-line text-ink-secondary hover:border-line-strong"
                  }`}
                >
                  <span className="text-xl">{level.emoji}</span>
                  <span className="text-[10px] font-medium">{level.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Feeling chips */}
          <div>
            <label className="block text-sm font-medium text-white mb-3">
              In one word, how do you feel?
            </label>
            <div className="flex flex-wrap gap-2">
              {FEELING_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setFeeling(chip)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                    feeling === chip
                      ? "bg-accent text-base-950 border-accent font-medium"
                      : "bg-base-800 border-line text-ink-secondary hover:border-line-strong"
                  }`}
                >
                  {chip}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setFeeling("__custom__")}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  feeling === "__custom__"
                    ? "bg-accent text-base-950 border-accent font-medium"
                    : "bg-base-800 border-line text-ink-secondary hover:border-line-strong"
                }`}
              >
                Other…
              </button>
            </div>
            {feeling === "__custom__" && (
              <input
                type="text"
                value={customFeeling}
                onChange={(e) => setCustomFeeling(e.target.value)}
                placeholder="One word…"
                maxLength={24}
                className="mt-3 w-full rounded-[10px] bg-base-800 border border-line px-3 py-2 text-sm text-white placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent"
              />
            )}
          </div>

          {/* Gratitude */}
          <div>
            <label className="block text-sm font-medium text-white mb-3">
              What are you grateful for today?
            </label>
            <textarea
              value={gratitude}
              onChange={(e) => setGratitude(e.target.value)}
              rows={3}
              placeholder="Write a sentence or two…"
              className="w-full rounded-[10px] bg-base-800 border border-line px-3 py-2 text-sm text-white placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent resize-none"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="button"
            onClick={handleUnlock}
            disabled={!canUnlock || submitting}
            className="w-full rounded-[10px] bg-accent hover:bg-accent-light disabled:opacity-40 disabled:cursor-not-allowed text-base-950 font-semibold text-sm py-3 transition-colors"
          >
            {submitting ? "Unlocking…" : "Unlock Mission Control"}
          </button>
        </div>
      </div>
    </div>
  );
}
