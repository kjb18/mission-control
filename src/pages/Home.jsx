import WeeklyPlan from "./home/WeeklyPlan";
import FocusEngine from "./home/FocusEngine";
import BusinessPulse from "./home/BusinessPulse";
import GrowthLayer from "./home/GrowthLayer";
import MonthCalendar from "./home/MonthCalendar";

export default function Home() {
  return (
    <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-6 space-y-2">
      <WeeklyPlan />
      <FocusEngine />
      <BusinessPulse />
      <GrowthLayer />
      <MonthCalendar />
    </div>
  );
}
