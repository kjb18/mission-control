export default function Card({ children, className = "", noPadding = false, ...props }) {
  return (
    <div
      className={`bg-base-900 border border-line rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] ${
        noPadding ? "" : "px-5 py-4"
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
