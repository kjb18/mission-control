import { supabase } from "./supabaseClient";

// The ClickUp API key lives only in the clickup-proxy Edge Function's
// CLICKUP_API_KEY secret now — see supabase/functions/clickup-proxy. It
// never reaches the browser, and the proxy requires a real authenticated
// owner session (a request bearing only the public anon key gets a 401).

export const CLICKUP_WORKSPACE_ID = "90161542297";
export const CLICKUP_ADMIN_FOLDER_ID = "90169022938";
export const STALE_DAYS_THRESHOLD = 14;

// List new "Source and quote" RFQ tasks land in (Ultra Power CRM, inside
// the Admin folder) — change this constant to redirect them elsewhere.
export const CLICKUP_RFQ_TASK_LIST_ID = "901614335408";

async function clickupFetch(path, { method = "GET", body } = {}) {
  const { data, error } = await supabase.functions.invoke("clickup-proxy", {
    body: { method, path, body },
  });
  if (error) throw new Error(error.message ?? "ClickUp proxy request failed.");
  return data;
}

function normalizeTask(task) {
  const dateUpdatedMs = task.date_updated ? Number(task.date_updated) : null;
  const dueDateMs = task.due_date ? Number(task.due_date) : null;
  const daysSinceActivity = dateUpdatedMs
    ? Math.floor((Date.now() - dateUpdatedMs) / (1000 * 60 * 60 * 24))
    : null;

  return {
    id: task.id,
    name: task.name,
    status: task.status?.status ?? "unknown",
    url: task.url,
    dueDate: dueDateMs ? new Date(dueDateMs) : null,
    lastActivity: dateUpdatedMs ? new Date(dateUpdatedMs) : null,
    daysSinceActivity,
    isStale: daysSinceActivity !== null && daysSinceActivity >= STALE_DAYS_THRESHOLD,
    listName: task.list?.name ?? null,
  };
}

async function fetchFolderLists(folderId) {
  const data = await clickupFetch(`/folder/${folderId}/list`);
  return data.lists ?? [];
}

async function fetchListTasks(listId) {
  const data = await clickupFetch(`/list/${listId}/task?include_closed=false`);
  return data.tasks ?? [];
}

export async function fetchAdminBacklogTasks() {
  const lists = await fetchFolderLists(CLICKUP_ADMIN_FOLDER_ID);
  const tasksByList = await Promise.all(
    lists.map(async (list) => {
      const tasks = await fetchListTasks(list.id);
      return tasks.map((t) => ({ ...t, list: { name: list.name } }));
    })
  );
  return tasksByList
    .flat()
    .map(normalizeTask)
    .sort((a, b) => {
      // Stale tasks first, then soonest due date, then most recently touched.
      if (a.isStale !== b.isStale) return a.isStale ? -1 : 1;
      if (a.dueDate && b.dueDate) return a.dueDate - b.dueDate;
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return (b.lastActivity ?? 0) - (a.lastActivity ?? 0);
    });
}

export async function updateTaskDueDate(taskId, dueDate) {
  return clickupFetch(`/task/${taskId}`, {
    method: "PUT",
    body: { due_date: dueDate.getTime(), due_date_time: true },
  });
}

export async function createTask(listId, { name, dueDate, description }) {
  return clickupFetch(`/list/${listId}/task`, {
    method: "POST",
    body: {
      name,
      description,
      ...(dueDate ? { due_date: dueDate.getTime(), due_date_time: true } : {}),
    },
  });
}
