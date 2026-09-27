import { SectionLabel } from "../../components/ui";

export default function SectionHeader({ eyebrow, title, subtitle, action, tone }) {
  return (
    <div>
      {eyebrow && (
        <SectionLabel tone={tone === "purple" ? "purple" : "blue"} className="!mb-1">
          {eyebrow}
        </SectionLabel>
      )}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-white">{title}</h2>
        {action}
      </div>
      {subtitle && <p className="text-xs text-ink-secondary mt-0.5 mb-2">{subtitle}</p>}
    </div>
  );
}
