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

const NAV_SECTIONS = [
  {
    label: null,
    items: [{ to: "/", label: "Home", icon: HomeIcon, end: true }],
  },
  {
    label: "Operations",
    items: [
      { to: "/pipeline", label: "Pipeline", icon: PipelineIcon },
      { to: "/intake", label: "Intake", icon: IntakeIcon },
      { to: "/sourcing", label: "Sourcing", icon: SourcingIcon },
      { to: "/quote-builder", label: "Quote Builder", icon: QuoteIcon },
      { to: "/ledger", label: "Ledger", icon: LedgerIcon },
    ],
  },
  {
    label: "Growth",
    items: [
      { to: "/crosshairs", label: "Crosshairs", icon: CrosshairsIcon, tone: "purple" },
      { to: "/wins", label: "Wins", icon: TrophyIcon },
      { to: "/okrs", label: "OKRs", icon: OkrIcon, tone: "purple" },
      { to: "/brewing", label: "Brewing", icon: BrewingIcon },
      { to: "/content", label: "Content", icon: ContentIcon, tone: "purple" },
      { to: "/seo", label: "SEO", icon: SeoIcon, tone: "purple" },
    ],
  },
  {
    label: "Workspace",
    items: [
      { to: "/contacts", label: "Contacts", icon: ContactsIcon },
      { to: "/learning-hub", label: "Learning Hub", icon: LearningIcon },
      { to: "/settings", label: "Settings", icon: SettingsIcon },
    ],
  },
];

export default function Sidebar({ isOpen, onNavigate }) {
  return (
    <aside
      className={`fixed md:static inset-y-0 left-0 z-40 w-[200px] shrink-0 bg-sidebar border-r border-line flex flex-col transition-transform duration-200 ${
        isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      }`}
    >
      <div className="flex items-center gap-2.5 px-3 py-3 border-b border-line">
        <div
          className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0"
          style={{ background: "linear-gradient(135deg, #3b82f6, #7c3aed)" }}
        >
          <LogoMark className="w-4 h-4 text-white" />
        </div>
        <div className="leading-tight min-w-0">
          <p className="text-white font-medium text-[12px] truncate">Ultra Power</p>
          <p className="text-ink-muted" style={{ fontSize: 10, lineHeight: 1.25 }}>
            Engineering Solutions Director
          </p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-3">
        {NAV_SECTIONS.map((section, si) => (
          <div key={si}>
            {section.label && (
              <p
                className="uppercase text-ink-muted px-2 mb-1"
                style={{ fontSize: 9, letterSpacing: "0.07em", fontWeight: 500 }}
              >
                {section.label}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map(({ to, label, icon: Icon, end, tone }) => {
                const isPurple = tone === "purple";
                return (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      `flex items-center gap-2 rounded-md border-l-2 text-[11px] transition-colors ${
                        isActive
                          ? isPurple
                            ? "border-violet-600 bg-violet-600/10 text-white font-medium"
                            : "border-accent bg-accent/10 text-white font-medium"
                          : "border-transparent text-ink-secondary hover:bg-base-800 hover:text-white"
                      }`
                    }
                    style={{ padding: "5px 10px" }}
                  >
                    {({ isActive }) => (
                      <>
                        <Icon
                          className={`w-[15px] h-[15px] shrink-0 ${
                            isActive ? (isPurple ? "text-violet-600" : "text-accent") : "text-ink-muted"
                          }`}
                        />
                        <span className="truncate">{label}</span>
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
