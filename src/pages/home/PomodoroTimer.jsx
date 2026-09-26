import { useEffect, useRef, useState } from "react";

const FOCUS_SECONDS = 25 * 60;
const BREAK_SECONDS = 5 * 60;

export default function PomodoroTimer() {
  const [mode, setMode] = useState("focus"); // focus | break
  const [secondsLeft, setSecondsLeft] = useState(FOCUS_SECONDS);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          const nextMode = mode === "focus" ? "break" : "focus";
          setMode(nextMode);
          return nextMode === "focus" ? FOCUS_SECONDS : BREAK_SECONDS;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [running, mode]);

  function reset() {
    setRunning(false);
    setMode("focus");
    setSecondsLeft(FOCUS_SECONDS);
  }

  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const seconds = String(secondsLeft % 60).padStart(2, "0");
  const total = mode === "focus" ? FOCUS_SECONDS : BREAK_SECONDS;
  const progress = 1 - secondsLeft / total;

  return (
    <div>
      <p className="text-xs font-medium text-ink-secondary mb-2">
        Pomodoro — {mode === "focus" ? "Focus" : "Break"}
      </p>
      <div className="bg-base-800 border border-line rounded-[10px] p-4 flex items-center gap-4">
        <div className="relative w-16 h-16 shrink-0">
          <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
            <circle cx="18" cy="18" r="16" fill="none" stroke="#e2e8f0" strokeWidth="2" />
            <circle
              cx="18"
              cy="18"
              r="16"
              fill="none"
              stroke={mode === "focus" ? "#3b82f6" : "#34d399"}
              strokeWidth="2"
              strokeDasharray={2 * Math.PI * 16}
              strokeDashoffset={2 * Math.PI * 16 * (1 - progress)}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-xs font-mono text-white">
            {minutes}:{seconds}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setRunning((r) => !r)}
            className="px-4 py-2 rounded-[10px] bg-accent hover:bg-accent-light text-base-950 text-sm font-medium"
          >
            {running ? "Pause" : "Start"}
          </button>
          <button
            onClick={reset}
            className="px-3 py-2 rounded-[10px] bg-base-800 hover:bg-base-800/80 border-[0.5px] border-line-strong text-white text-sm"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
