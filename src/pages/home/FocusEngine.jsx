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
      <SectionHeader eyebrow="Today" title="Focus Engine" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-1.5 items-start">
        <div className="flex flex-col gap-1.5">
          <Card>
            <MitsList />
          </Card>
          <LearningHubCard />
        </div>
        <Card className="flex flex-col gap-2">
          <TimeBlocksToday />
          <PomodoroTimer />
          <ShutdownRitual />
        </Card>
      </div>
    </section>
  );
}
