import SectionHeader from "./SectionHeader";
import GrowthPanel from "./GrowthPanel";

export default function GrowthLayer() {
  return (
    <section>
      <SectionHeader
        eyebrow="Growth"
        title="Growth Layer"
        subtitle="Targets in the crosshairs, what's queued, and what's brewing."
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <GrowthPanel
          storageKey="mc:growth:crosshairs"
          title="Crosshairs"
          accent="bg-accent"
          placeholder="A target account or goal…"
        />
        <GrowthPanel
          storageKey="mc:growth:backlog"
          title="Backlog"
          accent="bg-sky-400"
          placeholder="Something queued up…"
        />
        <GrowthPanel
          storageKey="mc:growth:brewing"
          title="Brewing"
          accent="bg-emerald-400"
          placeholder="An idea still forming…"
        />
      </div>
    </section>
  );
}
