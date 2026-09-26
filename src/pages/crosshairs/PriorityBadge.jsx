const STYLES = {
  Hot: "text-red-600 bg-red-400/15",
  Medium: "text-orange-600 bg-orange-500/15",
  Low: "text-blue-600 bg-blue-500/15",
  Nurturing: "text-blue-600 bg-blue-500/15",
};

export default function PriorityBadge({ priority }) {
  return (
    <span className={`text-[11px] font-medium rounded-full px-2 py-0.5 ${STYLES[priority] ?? "text-ink-secondary bg-base-800/60"}`}>
      {priority}
    </span>
  );
}
