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
  TrophyIcon,
  BrewingIcon,
  ContentIcon,
  SeoIcon,
  ContactsIcon,
  LearningIcon,
  SettingsIcon,
  LogoMark,
} from "./icons";

const NAV_ITEMS = [
  { to: "/", label: "Home", icon: HomeIcon, end: true },
  { to: "/pipeline", label: "Pipeline", icon: PipelineIcon },
  { to: "/intake", label: "Intake", icon: IntakeIcon },
  { to: "/sourcing", label: "Sourcing", icon: SourcingIcon },
  { to: "/quote-builder", label: "Quote Builder", icon: QuoteIcon },
  { to: "/ledger", label: "Ledger", icon: LedgerIcon },
  { to: "/crosshairs", label: "Crosshairs", icon: CrosshairsIcon },
  { to: "/wins", label: "Wins", icon: TrophyIcon },
  { to: "/okrs", label: "OKRs", icon: OkrIcon },
  { to: "/brewing", label: "Brewing", icon: BrewingIcon },
  { to: "/content", label: "Content", icon: ContentIcon },
  { to: "/seo", label: "SEO", icon: SeoIcon },
  { to: "/contacts", label: "Contacts", icon: ContactsIcon },
  { to: "/learning-hub", label: "Learning Hub", icon: LearningIcon },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

export default function Sidebar({ isOpen, onNavigate }) {
  return (
    <aside
      className={`fixed md:static inset-y-0 left-0 z-40 w-[156px] shrink-0 bg-sidebar border-r border-line flex flex-col transition-transform duration-200 ${
        isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      }`}
    >
      <div className="flex items-center gap-2 px-3 h-11 border-b border-line">
        <LogoMark className="w-5 h-5 text-accent shrink-0" />
        <div className="leading-tight min-w-0">
          <p className="text-white font-medium text-[11px] truncate">Mission Control</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-2 rounded-md border-l-2 text-[11px] transition-colors ${
                isActive
                  ? "border-accent bg-accent/10 text-white font-medium"
                  : "border-transparent text-ink-secondary hover:bg-base-800 hover:text-white"
              }`
            }
            style={{ padding: "5px 10px" }}
          >
            {({ isActive }) => (
              <>
                <Icon
                  className={`w-[15px] h-[15px] shrink-0 ${
                    isActive ? "text-accent" : "text-ink-muted"
                  }`}
                />
                <span className="truncate">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
