import { useAuth } from "../lib/AuthContext";
import { useCheckIn } from "../lib/CheckInContext";
import { LogoMark } from "./icons";

const TODAY_LABEL = new Date().toLocaleDateString("en-US", {
  weekday: "long",
  month: "short",
  day: "numeric",
});

export default function TopBar() {
  const { user, signOut } = useAuth();
  const { isComplete, openGate } = useCheckIn();

  return (
    <header
      className="shrink-0 border-b border-line bg-sidebar flex items-center gap-3 px-3 md:px-4"
      style={{ height: 44 }}
    >
      <div className="flex items-center gap-2 md:hidden">
        <LogoMark className="w-4 h-4 text-accent shrink-0" />
      </div>

      <p className="hidden md:block text-white font-medium" style={{ fontSize: 13 }}>
        Mission Control
      </p>

      <p className="hidden sm:block text-blue-400 truncate" style={{ fontSize: 10 }}>
        {TODAY_LABEL}
      </p>

      <div className="flex-1" />

      <button
        onClick={openGate}
        title={isComplete ? "Daily check-in complete — tap to redo" : "Daily check-in pending"}
        className={`mc-badge rounded-full transition-colors ${
          isComplete
            ? "bg-accent text-base-950"
            : "bg-base-800 text-ink-secondary hover:text-white"
        }`}
      >
        {isComplete ? "On track" : "Check in"}
      </button>

      <div className="flex items-center gap-2 pl-2 ml-1 border-l border-line">
        <div className="w-6 h-6 rounded-full bg-accent/20 text-accent flex items-center justify-center text-[10px] font-medium">
          {user?.email?.[0]?.toUpperCase() ?? "?"}
        </div>
        <button
          onClick={signOut}
          className="hidden sm:inline text-ink-muted hover:text-white"
          style={{ fontSize: 10 }}
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
