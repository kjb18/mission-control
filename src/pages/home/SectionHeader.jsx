export default function SectionHeader({ eyebrow, title, subtitle, action, tone }) {
  return (
    <div className="mb-2">
      {eyebrow && (
        <div className={`mc-section-label mb-1 ${tone === "purple" ? "mc-section-label-purple" : ""}`}>
          {eyebrow}
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-white">{title}</h2>
        {action}
      </div>
      {subtitle && <p className="text-xs text-ink-secondary mt-0.5">{subtitle}</p>}
    </div>
  );
}
