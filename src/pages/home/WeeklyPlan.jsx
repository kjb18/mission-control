import { addDays, toISODate, formatWeekday, formatDayNumber } from "../../lib/dateUtils";
import { useWeekEvents } from "../../lib/useWeekEvents";
import SectionHeader from "./SectionHeader";
import { Card, Badge } from "../../components/ui";

// The plan always shows a full Mon–Fri work week: the week containing
// today when today is a weekday, or the upcoming week when today falls
// on a Saturday or Sunday (nothing to plan for a week that's already over).
function startOfPlanWeek(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 = Sun .. 6 = Sat
  const diff = day === 0 ? 1 : day === 6 ? 2 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

export default function WeeklyPlan() {
  const weekStart = startOfPlanWeek(new Date());
  const weekEnd = addDays(weekStart, 4);
  const days = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));
  const todayISO = toISODate(new Date());

  const { pipelineByDate, meetingEvents, calendarError } = useWeekEvents(weekStart, weekEnd);

  return (
    <section>
      <SectionHeader eyebrow="This Week" title="Weekly Plan" />

      {calendarError && (
        <p className="text-[10px] text-orange-600/80 bg-orange-500/10 border border-orange-500/20 rounded px-2 py-1 mb-1.5">
          {calendarError}
        </p>
      )}

      <Card noPadding className="p-2" style={{ maxHeight: 140, overflow: "hidden" }}>
        <div className="grid grid-cols-5 gap-1.5">
          {days.map((d) => {
            const iso = toISODate(d);
            const isToday = iso === todayISO;
            const dayEvents = pipelineByDate[iso] ?? [];
            const dayMeetings = meetingEvents.filter((ev) => ev.start && toISODate(ev.start) === iso);
            const chips = [
              ...dayEvents.map((ev) => ({ label: ev.label, variant: ev.variant })),
              ...dayMeetings.map((ev) => ({ label: ev.title, variant: "purple" })),
            ];

            return (
              <div key={iso} className={`text-center rounded ${isToday ? "bg-accent/10" : ""}`}>
                <p
                  className="uppercase text-ink-muted font-medium"
                  style={{ fontSize: 7, letterSpacing: "0.04em" }}
                >
                  {formatWeekday(d)}
                </p>
                <p
                  className={`font-semibold ${isToday ? "text-accent" : "text-white"}`}
                  style={{ fontSize: 9 }}
                >
                  {formatDayNumber(d)}
                </p>
                <div className="mt-1 space-y-0.5 px-0.5">
                  {chips.slice(0, 3).map((chip, i) => (
                    <Badge
                      key={i}
                      variant={chip.variant}
                      title={chip.label}
                      className="block w-full truncate !text-[7px] !leading-tight !px-1 !py-0"
                    >
                      {chip.label}
                    </Badge>
                  ))}
                  {chips.length > 3 && (
                    <p className="text-ink-muted" style={{ fontSize: 7 }}>
                      +{chips.length - 3}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </section>
  );
}
