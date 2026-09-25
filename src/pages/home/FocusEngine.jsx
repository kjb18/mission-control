import SectionHeader from "./SectionHeader";
import MitsList from "./MitsList";
import TimeBlocksToday from "./TimeBlocksToday";
import PomodoroTimer from "./PomodoroTimer";
import ShutdownRitual from "./ShutdownRitual";
import LearningHubCard from "./LearningHubCard";

export default function FocusEngine() {
  return (
    <section>
      <SectionHeader
        eyebrow="Today"
        title="Focus Engine"
        subtitle="MITs, time blocks, a Pomodoro clock, learning streak, and your shutdown ritual."
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[6px]">
        <div className="rounded-lg border-[0.5px] border-line bg-base-900 px-3 py-2.5">
          <MitsList />
        </div>
        <div className="rounded-lg border-[0.5px] border-line bg-base-900 px-3 py-2.5">
          <TimeBlocksToday />
        </div>
        <div className="rounded-lg border-[0.5px] border-line bg-base-900 px-3 py-2.5">
          <PomodoroTimer />
        </div>
        <div className="rounded-lg border-[0.5px] border-line bg-base-900 px-3 py-2.5">
          <ShutdownRitual />
        </div>
        <LearningHubCard />
      </div>
    </section>
  );
}
