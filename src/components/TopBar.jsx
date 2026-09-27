import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCheckIn } from "../lib/CheckInContext";
import { SparkleIcon } from "./icons";
import { PageHeader, Badge, Button } from "./ui";

const TODAY_LABEL = new Date().toLocaleDateString("en-US", {
  weekday: "long",
  month: "short",
  day: "numeric",
});

export default function TopBar() {
  const navigate = useNavigate();
  const { isComplete, openGate } = useCheckIn();
  const [syncing, setSyncing] = useState(false);

  function handleSync() {
    setSyncing(true);
    window.location.reload();
  }

  return (
    <header
      className="shrink-0 border-b border-line bg-sidebar flex items-center gap-3 px-3 md:px-4"
      style={{ height: 52 }}
    >
      <div className="min-w-0 flex-1">
        <PageHeader title="Mission Control" compact />
      </div>

      <div className="hidden sm:flex items-center gap-1 shrink-0">
        <SparkleIcon className="w-3 h-3 text-violet-600 shrink-0" />
        <p className="text-blue-600 truncate" style={{ fontSize: 10 }}>
          {TODAY_LABEL}
        </p>
      </div>

      <button onClick={openGate} className="shrink-0">
        <Badge variant="blue">{isComplete ? "On track" : "Check in"}</Badge>
      </button>

      <Button variant="secondary" onClick={handleSync} disabled={syncing} className="shrink-0 hidden sm:inline-flex">
        {syncing ? "Syncing…" : "Sync"}
      </Button>

      <Button variant="primary" onClick={() => navigate("/intake")} className="shrink-0">
        + New RFQ
      </Button>
    </header>
  );
}
