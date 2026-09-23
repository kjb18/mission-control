import { useAuth } from "../lib/AuthContext";
import { useCheckIn } from "../lib/CheckInContext";

export default function TopBar({ onMenuClick }) {
  const { user, signOut } = useAuth();
  const { isComplete, openGate } = useCheckIn();

  return (
    <header className="h-16 shrink-0 border-b border-white/10 bg-base-900/80 backdrop-blur flex items-center gap-3 px-4 md:px-6">
      <button
        onClick={onMenuClick}
        className="md:hidden text-white/60 hover:text-white p-2 -ml-2"
        aria-label="Toggle menu"
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <div className="flex-1" />

      <button
        onClick={openGate}
        title={isComplete ? "Daily check-in complete — tap to redo" : "Daily check-in pending"}
        className="flex items-center gap-2 rounded-full border border-white/10 bg-base-800 pl-2.5 pr-3 py-1.5 hover:border-white/20 transition-colors"
      >
        <span
          className={`w-2 h-2 rounded-full ${
            isComplete ? "bg-emerald-400 shadow-[0_0_8px_theme(colors.emerald.400)]" : "bg-white/20"
          }`}
        />
        <span className="text-xs text-white/60 font-medium hidden sm:inline">
          {isComplete ? "Checked in" : "Check in"}
        </span>
      </button>

      <div className="flex items-center gap-2 pl-2 ml-1 border-l border-white/10">
        <div className="w-8 h-8 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs font-semibold">
          {user?.email?.[0]?.toUpperCase() ?? "?"}
        </div>
        <button
          onClick={signOut}
          className="hidden sm:inline text-xs text-white/40 hover:text-white/80"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
