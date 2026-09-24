import PriorityBadge from "./PriorityBadge";

const currency = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });

function daysSince(dateStr) {
  if (!dateStr) return null;
  const then = new Date(`${dateStr}T00:00:00`).getTime();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - then) / 86400000);
}

export default function TargetCard({ target, onLogTouchpoint, onEdit }) {
  const since = daysSince(target.last_touchpoint_date);
  const neglected = target.priority === "Hot" && (since === null || since >= 2);

  return (
    <div
      className={`rounded-2xl border bg-base-900 p-4 space-y-2.5 ${
        neglected ? "border-red-400/40" : "border-white/10"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-white">{target.target_name}</p>
          <p className="text-xs text-white/40">{target.industry || "—"}</p>
        </div>
        <PriorityBadge priority={target.priority} />
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-white/30">Deal value</p>
          <p className="text-white/80">
            {target.estimated_value ? currency.format(target.estimated_value) : "—"}
          </p>
        </div>
        <div>
          <p className="text-white/30">Stage</p>
          <p className="text-white/80">{target.current_stage || "—"}</p>
        </div>
        <div>
          <p className="text-white/30">Contact</p>
          <p className="text-white/80">{target.primary_contact_name || "—"}</p>
        </div>
        <div>
          <p className="text-white/30">Last touchpoint</p>
          <p className={neglected ? "text-red-300" : "text-white/80"}>
            {target.last_touchpoint_date ? `${target.last_touchpoint_date} (${since}d ago)` : "Never"}
          </p>
        </div>
      </div>

      {target.next_suggested_action && (
        <p className="text-xs text-accent/90 bg-accent/10 rounded-lg px-2.5 py-1.5">
          Next: {target.next_suggested_action}
        </p>
      )}
      {target.notes && <p className="text-xs text-white/40 line-clamp-2">{target.notes}</p>}

      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onLogTouchpoint(target)}
          className="flex-1 text-xs px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-light text-base-950 font-medium"
        >
          Log Touchpoint
        </button>
        <button
          onClick={() => onEdit(target)}
          className="text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white font-medium"
        >
          Edit
        </button>
      </div>
    </div>
  );
}
