import SectionHeader from "./SectionHeader";
import CrosshairsPanel from "./CrosshairsPanel";
import BacklogPanel from "./BacklogPanel";
import BrewingPanel from "./BrewingPanel";
import WinsPanel from "./WinsPanel";
import OkrPanel from "./OkrPanel";

export default function GrowthLayer() {
  return (
    <section>
      <SectionHeader eyebrow="Growth" title="Growth Layer" tone="purple" />
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-1.5">
        <CrosshairsPanel />
        <BacklogPanel />
        <BrewingPanel />
        <WinsPanel />
        <OkrPanel />
      </div>
    </section>
  );
}
