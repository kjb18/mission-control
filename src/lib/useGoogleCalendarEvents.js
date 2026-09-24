import { useEffect, useState } from "react";
import { listEvents } from "./googleCalendar";

export function useGoogleCalendarEvents(timeMin, timeMax) {
  const [events, setEvents] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listEvents({ timeMin, timeMax }).then((result) => {
      if (cancelled) return;
      setEvents(result.events);
      setError(result.error);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [timeMin.getTime(), timeMax.getTime()]);

  return { events, error, loading };
}
