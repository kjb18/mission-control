const VARIANTS = {
  blue: "bg-blue-100 text-blue-800",
  purple: "bg-violet-100 text-violet-800",
  green: "bg-emerald-100 text-emerald-800",
  amber: "bg-amber-100 text-amber-800",
  red: "bg-red-100 text-red-800",
  gray: "bg-slate-100 text-slate-600",
};

export default function Badge({ variant = "gray", children, className = "", ...props }) {
  return (
    <span
      className={`inline-flex items-center text-[9px] font-medium rounded px-2 py-0.5 ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
