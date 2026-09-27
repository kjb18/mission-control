export default function PageHeader({ title, subtitle, action, compact = false }) {
  return (
    <div className={`flex items-center justify-between gap-4 ${compact ? "" : "items-start pb-5"}`}>
      <div className="min-w-0">
        <h1 className="text-xl font-medium text-white truncate leading-none">{title}</h1>
        {subtitle && <p className="text-[13px] text-ink-secondary mt-1">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
