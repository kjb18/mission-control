import SectionHeader from "./SectionHeader";
import MitsList from "./MitsList";
import TimeBlocksToday from "./TimeBlocksToday";
import PomodoroTimer from "./PomodoroTimer";
import ShutdownRitual from "./ShutdownRitual";
import LearningHubCard from "./LearningHubCard";
import { Card } from "../../components/ui";

export default function FocusEngine() {
  return (
    <section>
      <SectionHeader
        eyebrow="Today"
        title="Focus Engine"
        subtitle="MITs, time blocks, a Pomodoro clock, learning streak, and your shutdown ritual."
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <MitsList />
        </Card>
        <Card>
          <TimeBlocksToday />
        </Card>
        <Card>
          <PomodoroTimer />
        </Card>
        <Card>
          <ShutdownRitual />
        </Card>
        <LearningHubCard />
      </div>
    </section>
  );
}
