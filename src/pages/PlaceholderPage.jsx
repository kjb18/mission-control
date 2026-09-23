export default function PlaceholderPage({ title, description }) {
  return (
    <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-10">
      <p className="text-[11px] uppercase tracking-widest text-accent font-medium mb-1">
        Coming Soon
      </p>
      <h1 className="text-2xl font-semibold text-white mb-2">{title}</h1>
      <p className="text-sm text-white/40 max-w-lg">
        {description ?? "This module is scaffolded and routable now — the full build lands in a later session."}
      </p>
    </div>
  );
}
