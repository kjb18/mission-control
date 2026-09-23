import { NavLink } from "react-router-dom";
import {
  HomeIcon,
  PipelineIcon,
  IntakeIcon,
  SourcingIcon,
  QuoteIcon,
  LedgerIcon,
  CrosshairsIcon,
  OkrIcon,
  ContentIcon,
  SeoIcon,
  ContactsIcon,
  LearningIcon,
  SettingsIcon,
} from "./icons";

const NAV_ITEMS = [
  { to: "/", label: "Home", icon: HomeIcon, end: true },
  { to: "/pipeline", label: "Pipeline", icon: PipelineIcon },
  { to: "/intake", label: "Intake", icon: IntakeIcon },
  { to: "/sourcing", label: "Sourcing", icon: SourcingIcon },
  { to: "/quote-builder", label: "Quote Builder", icon: QuoteIcon },
  { to: "/ledger", label: "Ledger", icon: LedgerIcon },
  { to: "/crosshairs", label: "Crosshairs", icon: CrosshairsIcon },
  { to: "/okrs", label: "OKRs", icon: OkrIcon },
  { to: "/content", label: "Content", icon: ContentIcon },
  { to: "/seo", label: "SEO", icon: SeoIcon },
  { to: "/contacts", label: "Contacts", icon: ContactsIcon },
  { to: "/learning-hub", label: "Learning Hub", icon: LearningIcon },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

export default function Sidebar({ isOpen, onNavigate }) {
  return (
    <aside
      className={`fixed md:static inset-y-0 left-0 z-40 w-64 shrink-0 bg-base-900 border-r border-white/10 flex flex-col transition-transform duration-200 ${
        isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      }`}
    >
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-white/10">
        <img src="/pwa-192x192.png" alt="" className="w-8 h-8 rounded-lg" />
        <div className="leading-tight">
          <p className="text-white font-semibold text-sm">Mission Control</p>
          <p className="text-white/40 text-[11px]">Ultra Power Industrial</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                isActive
                  ? "bg-accent/15 text-white font-medium"
                  : "text-white/55 hover:bg-white/5 hover:text-white/90"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  className={`w-[18px] h-[18px] shrink-0 ${
                    isActive ? "text-accent" : "text-white/40"
                  }`}
                />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
