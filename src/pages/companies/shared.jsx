import { FlameIcon } from "../../components/icons";

export const slug = (s) => String(s).toLowerCase().replace(/\s+/g, "-");
export const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

export const TypePill = ({ type }) => <span className={`co-type co-type-${slug(type)}`}>{type}</span>;
export const StatusBadge = ({ status }) => <span className={`co-badge st-${status}`}>{cap(status)}</span>;
export const PriorityBadge = ({ priority }) =>
  priority ? <span className={`co-badge pr-${priority.toLowerCase()}`}>{priority}</span> : null;
export const TierBadge = ({ tier }) => (tier ? <span className={`co-badge tier-${tier.toLowerCase()}`}>Tier {tier}</span> : null);
export const Flame = ({ size = 14 }) => <FlameIcon width={size} height={size} className="co-flame" aria-label="On Crosshairs" />;

export const phpFmt = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });
