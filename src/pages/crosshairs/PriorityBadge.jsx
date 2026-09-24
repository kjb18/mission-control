const STYLES = {
  Hot: "text-red-300 bg-red-400/15",
  Medium: "text-amber-300 bg-amber-400/15",
  Low: "text-sky-300 bg-sky-400/15",
  Nurturing: "text-violet-300 bg-violet-400/15",
};

export default function PriorityBadge({ priority }) {
  return (
    <span className={`text-[11px] font-medium rounded-full px-2 py-0.5 ${STYLES[priority] ?? "text-white/40 bg-white/5"}`}>
      {priority}
    </span>
  );
}
