const VARIANTS = {
  primary: "bg-accent text-[#fff]",
  secondary: "bg-base-900 border border-line text-ink-secondary",
  danger: "bg-danger text-[#fff]",
};

export default function Button({
  variant = "primary",
  className = "",
  children,
  disabled,
  ...props
}) {
  return (
    <button
      disabled={disabled}
      className={`inline-flex items-center justify-center rounded-lg text-[13px] font-medium transition-all duration-150 hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none ${VARIANTS[variant]} ${className}`}
      style={{ padding: "8px 16px" }}
      {...props}
    >
      {children}
    </button>
  );
}
