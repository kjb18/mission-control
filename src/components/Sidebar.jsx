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
  PlanningIcon,
  ContentIcon,
  SeoIcon,
  BuildingIcon,
  PersonIcon,
  LearningIcon,
  TruckIcon,
  FunnelIcon,
  SettingsIcon,
  LogoMark,
} from "./icons";
import { SectionLabel, NavItem } from "./ui";
import { useAuth } from "../lib/AuthContext";
import { useCheckIn } from "../lib/CheckInContext";

const NAV_SECTIONS = [
  {
    label: null,
    items: [{ to: "/", label: "Home", icon: HomeIcon, end: true }],
  },
  {
    label: "Operations",
    items: [
      { to: "/triage", label: "Triage", icon: FunnelIcon, badgeKey: "triage" },
      { to: "/pipeline", label: "Pipeline", icon: PipelineIcon },
      { to: "/intake", label: "Intake", icon: IntakeIcon },
      { to: "/sourcing", label: "Sourcing", icon: SourcingIcon },
      { to: "/quote-builder", label: "Quote Builder", icon: QuoteIcon },
      { to: "/ledger", label: "Ledger", icon: LedgerIcon },
      { to: "/logistics", label: "Logistics", icon: TruckIcon },
    ],
  },
  {
    label: "Growth",
    items: [
      { to: "/crosshairs", label: "Crosshairs", icon: CrosshairsIcon, tone: "purple" },
      { to: "/wins", label: "Wins", icon: TrophyIcon },
      { to: "/okrs", label: "OKRs", icon: OkrIcon, tone: "purple" },
      { to: "/planning", label: "Planning", icon: PlanningIcon },
      { to: "/brewing", label: "Brewing", icon: BrewingIcon },
      { to: "/content", label: "Content", icon: ContentIcon, tone: "purple" },
      { to: "/seo", label: "SEO", icon: SeoIcon, tone: "purple" },
    ],
  },
  {
    label: "CRM",
    items: [
      { to: "/companies", label: "Companies", icon: BuildingIcon },
      { to: "/people", label: "People", icon: PersonIcon },
    ],
  },
  {
    label: "Workspace",
    items: [
      { to: "/learning-hub", label: "Learning Hub", icon: LearningIcon },
      { to: "/settings", label: "Settings", icon: SettingsIcon },
    ],
  },
];

export default function Sidebar({ isOpen, onNavigate, triageCount = 0 }) {
  const { user, signOut } = useAuth();
  const { isComplete } = useCheckIn();

  return (
    <aside
      className={`fixed md:static inset-y-0 left-0 z-40 w-[156px] shrink-0 bg-sidebar border-r border-line flex flex-col transition-transform duration-200 ${
        isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      }`}
    >
      <div className="flex items-center gap-2.5 border-b border-line" style={{ padding: 20 }}>
        <div
          className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0"
          style={{ background: "linear-gradient(135deg, #3b82f6, #7c3aed)" }}
        >
          <LogoMark className="w-4 h-4 text-white" />
        </div>
        <div className="leading-tight min-w-0">
          <p className="text-white font-medium text-[13px] truncate">Mission Control</p>
          <p className="text-ink-secondary truncate" style={{ fontSize: 11 }}>
            Ultra Power
          </p>
          <p className="text-ink-muted" style={{ fontSize: 10, lineHeight: 1.25 }}>
            Engineering Solutions Director
          </p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-3">
        {NAV_SECTIONS.map((section, si) => (
          <div key={si}>
            {section.label && (
              <div className="px-2">
                <SectionLabel tone="gray">{section.label}</SectionLabel>
              </div>
            )}
            <div className="space-y-0.5">
              {section.items.map(({ to, label, icon, end, tone, badgeKey }) => (
                <NavItem key={to} to={to} end={end} icon={icon} tone={tone} onClick={onNavigate} badge={badgeKey === "triage" ? triageCount : 0}>
                  {label}
                </NavItem>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="flex items-center gap-2 px-3 py-3 border-t border-line">
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${isComplete ? "bg-emerald-500" : "bg-line-strong"}`}
          title={isComplete ? "Checked in today" : "Check-in pending"}
        />
        <p className="text-ink-secondary truncate flex-1" style={{ fontSize: 10 }}>
          {user?.email ?? "—"}
        </p>
        <button
          onClick={signOut}
          className="text-ink-muted hover:text-white shrink-0"
          style={{ fontSize: 10 }}
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
