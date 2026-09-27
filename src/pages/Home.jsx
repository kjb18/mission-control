import BusinessPulse from "./home/BusinessPulse";
import WeeklyPlan from "./home/WeeklyPlan";
import FocusEngine from "./home/FocusEngine";
import GrowthLayer from "./home/GrowthLayer";
import MonthCalendar from "./home/MonthCalendar";

export default function Home() {
  return (
    <div style={{ margin: "-24px", padding: "10px 12px" }}>
      <div className="max-w-[1400px] mx-auto space-y-2">
        <BusinessPulse />
        <WeeklyPlan />
        <FocusEngine />
        <GrowthLayer />
        <MonthCalendar />
      </div>
    </div>
  );
}
