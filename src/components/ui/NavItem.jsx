import { NavLink } from "react-router-dom";

export default function NavItem({ to, end, icon: Icon, children, tone = "blue", onClick }) {
  const isPurple = tone === "purple";

  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      style={{ padding: "6px 12px", marginRight: 4 }}
      className={({ isActive }) =>
        `flex items-center gap-2 text-[11px] border-l-2 rounded-r-md transition-colors ${
          isActive
            ? isPurple
              ? "bg-violet-50 text-violet-800 border-violet-600"
              : "bg-blue-50 text-blue-800 border-accent"
            : "border-transparent text-ink-secondary hover:bg-base-800 hover:text-white"
        }`
      }
    >
      {({ isActive }) => (
        <>
          {Icon && (
            <Icon
              className={`w-[15px] h-[15px] shrink-0 ${
                isActive ? (isPurple ? "text-violet-600" : "text-accent") : "text-ink-muted"
              }`}
            />
          )}
          <span className="truncate">{children}</span>
        </>
      )}
    </NavLink>
  );
}
