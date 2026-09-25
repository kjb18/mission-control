import { NavLink } from "react-router-dom";
import { HomeIcon, PipelineIcon, SourcingIcon, LedgerIcon, MoreIcon } from "./icons";

const ITEMS = [
  { to: "/", label: "Home", icon: HomeIcon, end: true },
  { to: "/pipeline", label: "Pipeline", icon: PipelineIcon },
  { to: "/sourcing", label: "Sourcing", icon: SourcingIcon },
  { to: "/ledger", label: "Ledger", icon: LedgerIcon },
];

export default function MobileBottomNav({ onMore }) {
  return (
    <nav
      className="md:hidden fixed inset-x-0 bottom-0 z-40 bg-sidebar border-t border-line flex items-stretch"
      style={{ height: 52 }}
    >
      {ITEMS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center gap-0.5 ${
              isActive ? "text-accent" : "text-ink-muted"
            }`
          }
        >
          <Icon className="w-[18px] h-[18px]" />
          <span style={{ fontSize: 9 }}>{label}</span>
        </NavLink>
      ))}
      <button
        onClick={onMore}
        className="flex-1 flex flex-col items-center justify-center gap-0.5 text-ink-muted"
      >
        <MoreIcon className="w-[18px] h-[18px]" />
        <span style={{ fontSize: 9 }}>More</span>
      </button>
    </nav>
  );
}
