import Button from "./Button";

export default function EmptyState({ title, subtitle, ctaLabel, onCta, tone = "blue" }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 px-4">
      <div className="w-12 h-12 rounded-full bg-base-800 border border-line flex items-center justify-center mb-3">
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-ink-muted" fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="12" cy="12" r="9" strokeDasharray="3 3" />
          <path d="M9 12h6M12 9v6" strokeLinecap="round" />
        </svg>
      </div>
      <p className="text-[15px] font-medium text-white">{title}</p>
      {subtitle && <p className="text-[13px] text-ink-secondary mt-1 max-w-xs">{subtitle}</p>}
      {ctaLabel && onCta && (
        <Button
          variant="primary"
          onClick={onCta}
          className={`mt-4 ${tone === "purple" ? "!bg-violet-600" : ""}`}
        >
          {ctaLabel}
        </Button>
      )}
    </div>
  );
}
