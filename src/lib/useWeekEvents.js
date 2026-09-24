import { useEffect, useState } from "react";
import { fetchPipelineEventsByDate } from "./pipelineEvents";
import { useGoogleCalendarEvents } from "./useGoogleCalendarEvents";
import { toISODate } from "./dateUtils";

export function useWeekEvents(weekStart, weekEnd) {
  const [pipelineMap, setPipelineMap] = useState({});
  const [loading, setLoading] = useState(true);
  const startISO = toISODate(weekStart);
  const endISO = toISODate(weekEnd);

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

  const {
    events: meetingEvents,
    error: calendarError,
  } = useGoogleCalendarEvents(weekStart, weekEnd);

  return { pipelineByDate: pipelineMap, meetingEvents, calendarError, loading };
}
