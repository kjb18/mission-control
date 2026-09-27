const TONE = {
  blue: "text-accent",
  purple: "text-violet-600",
  gray: "text-ink-muted",
};

export default function SectionLabel({ children, tone = "blue", className = "" }) {
  return (
    <div className={`mb-3 ${className}`}>
      <p className={`text-[9px] font-medium uppercase tracking-[0.08em] ${TONE[tone]}`}>{children}</p>
      <div className="mt-1.5 h-px w-full bg-line" />
    </div>
  );
}
