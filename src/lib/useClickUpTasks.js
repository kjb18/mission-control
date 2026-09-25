import { useCallback, useEffect, useState } from "react";
import { fetchAdminBacklogTasks } from "./clickup";

export function useClickUpTasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminBacklogTasks();
      setTasks(data);
    } catch (e) {
      setError(e.message ?? "Failed to load ClickUp tasks.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { tasks, loading, error, refresh };
}
