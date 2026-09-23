import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "./supabaseClient";
import { todayISODate } from "./dateUtils";
import { useAuth } from "./AuthContext";

const CheckInContext = createContext(null);

export function CheckInProvider({ children }) {
  const { user } = useAuth();
  const [todayLog, setTodayLog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  const isComplete = todayLog?.status === "completed";

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("daily_logs")
      .select("*")
      .eq("log_date", todayISODate())
      .maybeSingle();

    if (!error) {
      setTodayLog(data);
      setIsOpen(!data || data.status !== "completed");
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (user) refresh();
  }, [user, refresh]);

  async function submit({ energyLevel, feeling, gratitude, mits }) {
    const payload = {
      log_date: todayISODate(),
      energy_level: energyLevel,
      feeling,
      gratitude,
      mits: mits ?? [],
      status: "completed",
      completed_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("daily_logs")
      .upsert(payload, { onConflict: "log_date" })
      .select()
      .single();

    if (error) throw error;
    setTodayLog(data);
    setIsOpen(false);
    return data;
  }

  async function updateMits(mits) {
    const payload = {
      log_date: todayISODate(),
      mits,
      energy_level: todayLog?.energy_level ?? null,
      feeling: todayLog?.feeling ?? null,
      gratitude: todayLog?.gratitude ?? null,
      status: todayLog?.status ?? "pending",
      completed_at: todayLog?.completed_at ?? null,
    };
    const { data, error } = await supabase
      .from("daily_logs")
      .upsert(payload, { onConflict: "log_date" })
      .select()
      .single();
    if (error) throw error;
    setTodayLog(data);
    return data;
  }

  function openGate() {
    setIsOpen(true);
  }

  function closeGate() {
    if (isComplete) setIsOpen(false);
  }

  const value = {
    todayLog,
    isComplete,
    loading,
    isOpen,
    openGate,
    closeGate,
    submit,
    updateMits,
    refresh,
  };

  return (
    <CheckInContext.Provider value={value}>{children}</CheckInContext.Provider>
  );
}

export function useCheckIn() {
  const ctx = useContext(CheckInContext);
  if (!ctx) throw new Error("useCheckIn must be used within CheckInProvider");
  return ctx;
}
