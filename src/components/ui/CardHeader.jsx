export default function CardHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-center justify-between py-3 px-5 border-b border-slate-100">
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-white truncate">{title}</p>
        {subtitle && <p className="text-[10px] text-ink-muted truncate mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="text-[10px] text-accent shrink-0 ml-3">{action}</div>}
    </div>
  );
}
