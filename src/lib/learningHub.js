import { supabase } from "./supabaseClient";
import { todayISODate } from "./dateUtils";

export async function fetchTopics() {
  const { data, error } = await supabase
    .from("learning_topics")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createTopic(fields) {
  const { data, error } = await supabase.from("learning_topics").insert(fields).select().single();
  if (error) throw error;
  return data;
}

export async function updateTopic(id, fields) {
  const { data, error } = await supabase
    .from("learning_topics")
    .update(fields)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTopic(id) {
  const { error } = await supabase.from("learning_topics").delete().eq("id", id);
  if (error) throw error;
}

function daysBetween(dateStr, todayStr) {
  const then = new Date(`${dateStr}T00:00:00`).getTime();
  const today = new Date(`${todayStr}T00:00:00`).getTime();
  return Math.round((today - then) / 86400000);
}

/**
 * Task 1: increments the streak on consecutive days, resets to 1 after a
 * skipped day, and no-ops the streak (but still allows a progress update)
 * if today was already logged.
 */
export function computeNextStreak(topic, todayStr = todayISODate()) {
  if (!topic.last_session_date) return 1;
  const gap = daysBetween(topic.last_session_date, todayStr);
  if (gap === 0) return topic.current_streak || 1; // already logged today
  if (gap === 1) return (topic.current_streak || 0) + 1; // consecutive
  return 1; // a day (or more) was skipped
}

export async function logSession(topicId, { progressPercent }) {
  const { data: topic, error: fetchError } = await supabase
    .from("learning_topics")
    .select("*")
    .eq("id", topicId)
    .single();
  if (fetchError) throw fetchError;

  const today = todayISODate();
  const nextStreak = computeNextStreak(topic, today);

  const { data, error } = await supabase
    .from("learning_topics")
    .update({
      current_streak: nextStreak,
      last_session_date: today,
      progress_percent: Math.max(0, Math.min(100, Number(progressPercent ?? topic.progress_percent))),
    })
    .eq("id", topicId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export function loggedToday(topic, todayStr = todayISODate()) {
  return topic.last_session_date === todayStr;
}
