import { useEffect, useState } from "react";
import { fetchPipelineEventsByDate, mergeMeetingEvents } from "./pipelineEvents";
import { useGoogleCalendarEvents } from "./useGoogleCalendarEvents";

export function useMonthEvents(year, month) {
  const [pipelineMap, setPipelineMap] = useState({});
  const [loading, setLoading] = useState(true);

  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);
  const startISO = toISODate(monthStart);
  const endISO = toISODate(monthEnd);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchPipelineEventsByDate(startISO, endISO).then((map) => {
      if (!cancelled) {
        setPipelineMap(map);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [startISO, endISO]);

  const { events: meetingEvents, error: calendarError } = useGoogleCalendarEvents(
    monthStart,
    monthEnd
  );

  const eventsByDate = mergeMeetingEvents(pipelineMap, meetingEvents);

  return { eventsByDate, loading, calendarError };
}

function toISODate(date) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 10);
}
