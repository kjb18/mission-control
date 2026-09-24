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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-white/10 bg-base-900 p-4">
          <MitsList />
        </div>
        <div className="rounded-2xl border border-white/10 bg-base-900 p-4">
          <TimeBlocksToday />
        </div>
        <div className="rounded-2xl border border-white/10 bg-base-900 p-4">
          <PomodoroTimer />
        </div>
        <div className="rounded-2xl border border-white/10 bg-base-900 p-4">
          <ShutdownRitual />
        </div>
        <LearningHubCard />
      </div>
    </section>
  );
}
