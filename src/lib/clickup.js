const API_KEY = import.meta.env.VITE_CLICKUP_API_KEY;
const BASE_URL = "https://api.clickup.com/api/v2";

export const CLICKUP_WORKSPACE_ID = "90161542297";
export const CLICKUP_ADMIN_FOLDER_ID = "90169022938";
export const STALE_DAYS_THRESHOLD = 14;

function assertConfigured() {
  if (!API_KEY) {
    throw new Error("VITE_CLICKUP_API_KEY is not set.");
  }
}

async function clickupFetch(path, options = {}) {
  assertConfigured();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: API_KEY,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`ClickUp API ${res.status}: ${body || res.statusText}`);
  }
  return res.json();
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
    body: JSON.stringify({
      due_date: dueDate.getTime(),
      due_date_time: true,
    }),
  });
}

export function isClickUpConfigured() {
  return Boolean(API_KEY);
}
