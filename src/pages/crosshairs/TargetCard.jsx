import PriorityBadge from "./PriorityBadge";
import { Card, Button } from "../../components/ui";

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
    <Card className={`space-y-2.5 ${neglected ? "!border-red-400/40" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-white">{target.target_name}</p>
          <p className="text-xs text-ink-secondary">{target.industry || "—"}</p>
        </div>
        <PriorityBadge priority={target.priority} />
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-ink-muted">Deal value</p>
          <p className="text-white">
            {target.estimated_value ? currency.format(target.estimated_value) : "—"}
          </p>
        </div>
        <div>
          <p className="text-ink-muted">Stage</p>
          <p className="text-white">{target.current_stage || "—"}</p>
        </div>
        <div>
          <p className="text-ink-muted">Contact</p>
          <p className="text-white">{target.primary_contact_name || "—"}</p>
        </div>
        <div>
          <p className="text-ink-muted">Last touchpoint</p>
          <p className={neglected ? "text-red-600" : "text-white"}>
            {target.last_touchpoint_date ? `${target.last_touchpoint_date} (${since}d ago)` : "Never"}
          </p>
        </div>
      </div>

      {target.next_suggested_action && (
        <p className="text-xs text-violet-600/90 bg-violet-600/10 rounded-[10px] px-2.5 py-1.5">
          Next: {target.next_suggested_action}
        </p>
      )}
      {target.notes && <p className="text-xs text-ink-secondary line-clamp-2">{target.notes}</p>}

      <div className="flex gap-2 pt-1">
        <Button variant="primary" className="flex-1 !bg-violet-600" onClick={() => onLogTouchpoint(target)}>
          Log Touchpoint
        </Button>
        <Button variant="secondary" onClick={() => onEdit(target)}>
          Edit
        </Button>
      </div>
    </Card>
  );
}
