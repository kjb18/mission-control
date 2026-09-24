import SectionHeader from "./SectionHeader";
import GrowthPanel from "./GrowthPanel";
import BacklogPanel from "./BacklogPanel";

export default function GrowthLayer() {
  return (
    <section>
      <SectionHeader
        eyebrow="Growth"
        title="Growth Layer"
        subtitle="Targets in the crosshairs, what's queued in ClickUp, and what's brewing."
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <GrowthPanel
          storageKey="mc:growth:crosshairs"
          title="Crosshairs"
          accent="bg-accent"
          placeholder="A target account or goal…"
        />
        <BacklogPanel />
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
