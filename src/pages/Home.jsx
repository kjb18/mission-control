import WeeklyPlan from "./home/WeeklyPlan";
import FocusEngine from "./home/FocusEngine";
import BusinessPulse from "./home/BusinessPulse";
import GrowthLayer from "./home/GrowthLayer";
import MonthCalendar from "./home/MonthCalendar";

export default function Home() {
  return (
    <div className="max-w-[1400px] mx-auto space-y-5">
      <WeeklyPlan />
      <FocusEngine />
      <BusinessPulse />
      <GrowthLayer />
      <MonthCalendar />
    </div>
  );
}
