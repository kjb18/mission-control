import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
import { SEED_AREAS } from "./taskFields";

// Areas → projects → missions (→ work_items). Tables from migration 0017.
// If the tables are unreachable, areas fall back to the six seed names and
// projects/missions to the localStorage lists used before the tables existed.

function localList(key) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export async function fetchHierarchy() {
  const [areas, projects, missions] = await Promise.all([
    supabase.from("areas").select("id, name, color, icon").order("name"),
    supabase.from("projects").select("id, name, area_id, status, due_date, description, created_at").order("created_at"),
    supabase.from("missions").select("id, name, project_id, area_id, status, priority, due_date, notes, created_at").order("created_at"),
  ]);
  const tablesOk = !areas.error && !projects.error && !missions.error;
  if (!tablesOk) {
    console.warn("[hierarchy] areas/projects/missions unavailable — using local fallbacks.");
    return {
      tablesOk,
      areas: SEED_AREAS.map((name) => ({ id: null, name })),
      projects: localList("mc_projects").map((name) => ({ id: null, name, area_id: null })),
      missions: localList("mc_missions").map((name) => ({ id: null, name, project_id: null, area_id: null })),
    };
  }
  return { tablesOk, areas: areas.data ?? [], projects: projects.data ?? [], missions: missions.data ?? [] };
}

export async function createProject({ name, areaId }) {
  const { data, error } = await supabase.from("projects").insert({ name, area_id: areaId ?? null, status: "open" }).select().single();
  if (error) throw error;
  return data;
}

export async function createMission({ name, projectId, areaId }) {
  const { data, error } = await supabase
    .from("missions")
    .insert({ name, project_id: projectId ?? null, area_id: areaId ?? null })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Loads the hierarchy and returns it plus the `hierarchy` object the task
 * panel expects: area names, projects filtered by area, missions filtered
 * by project, and inline create.
 */
export function useHierarchy() {
  const [state, setState] = useState({ tablesOk: false, areas: [], projects: [], missions: [] });
  const reload = useCallback(async () => setState(await fetchHierarchy()), []);
  useEffect(() => {
    reload();
  }, [reload]);

  const panel = useMemo(() => {
    const areaByName = (n) => state.areas.find((a) => a.name === n);
    const projectByName = (n) => state.projects.find((p) => p.name === n);
    return {
      areas: state.areas.map((a) => a.name),
      projectsFor: (areaName) => {
        const area = areaByName(areaName);
        return state.projects.filter((p) => !area?.id || p.area_id === area.id).map((p) => p.name);
      },
      missionsFor: (projectName) => {
        const project = projectByName(projectName);
        return state.missions.filter((m) => !project?.id || m.project_id === project.id).map((m) => m.name);
      },
      create: async (type, name, { area, project } = {}) => {
        if (!state.tablesOk) {
          const key = type === "project" ? "mc_projects" : "mc_missions";
          const list = localList(key);
          if (!list.includes(name)) localStorage.setItem(key, JSON.stringify([...list, name]));
        } else if (type === "project") {
          await createProject({ name, areaId: areaByName(area)?.id });
        } else {
          const p = projectByName(project);
          await createMission({ name, projectId: p?.id, areaId: areaByName(area)?.id ?? p?.area_id });
        }
        await reload();
      },
      ids: {
        area: (n) => areaByName(n)?.id ?? null,
        project: (n) => projectByName(n)?.id ?? null,
        mission: (n) => state.missions.find((m) => m.name === n)?.id ?? null,
      },
    };
  }, [state, reload]);

  return { ...state, reload, panel };
}
