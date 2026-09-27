import { Link } from "react-router-dom";
import Card from "./Card";

const TOP_BORDER = {
  blue: "border-t-blue-500",
  amber: "border-t-amber-500",
  green: "border-t-emerald-500",
  red: "border-t-red-500",
};

export default function StatCard({ label, value, sub, color, delta, deltaLabel, href }) {
  const topBorder = color ? TOP_BORDER[color] : "";
  const deltaUp = typeof delta === "number" && delta >= 0;

  return (
    <Card className={color ? `border-t-[3px] ${topBorder}` : ""}>
      <p className="text-[10px] uppercase text-ink-muted tracking-wide">{label}</p>
      <p className="text-[28px] font-medium text-white tabular-nums leading-tight mt-1">{value}</p>
      <div className="flex items-center gap-2 mt-1">
        {sub && <p className="text-[11px] text-ink-muted">{sub}</p>}
        {typeof delta === "number" && (
          <span
            className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${
              deltaUp ? "text-emerald-600" : "text-red-600"
            }`}
          >
            <svg viewBox="0 0 24 24" className="w-2.5 h-2.5" fill="currentColor">
              {deltaUp ? <path d="M12 4l7 8h-5v8h-4v-8H5z" /> : <path d="M12 20l-7-8h5V4h4v8h5z" />}
            </svg>
            {deltaLabel ?? `${Math.abs(delta)}%`}
          </span>
        )}
      </div>
      {href && (
        <Link to={href} className="inline-block text-[10px] text-accent hover:text-accent-light mt-2">
          View →
        </Link>
      )}
    </Card>
  );
}
