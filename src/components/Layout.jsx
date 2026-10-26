import { useCallback, useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import MobileBottomNav from "./MobileBottomNav";
import CheckInGate from "./CheckInGate";
import { countPendingTriage } from "../lib/triage";

const TRIAGE_REFRESH_MS = 5 * 60 * 1000;

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [triageCount, setTriageCount] = useState(0);

  // Pending-triage badge: on mount, every 5 minutes, and whenever the Triage page decides something.
  const refreshTriage = useCallback(() => {
    countPendingTriage()
      .then(setTriageCount)
      .catch((e) => console.warn("[Layout] triage count unavailable:", e.message));
  }, []);

  useEffect(() => {
    refreshTriage();
    const id = setInterval(refreshTriage, TRIAGE_REFRESH_MS);
    window.addEventListener("triage:changed", refreshTriage);
    return () => {
      clearInterval(id);
      window.removeEventListener("triage:changed", refreshTriage);
    };
  }, [refreshTriage]);

  return (
    <div className="flex h-screen bg-base-950 overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onNavigate={() => setSidebarOpen(false)} triageCount={triageCount} />

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6 pb-[76px] md:pb-6">
          <Outlet />
        </main>
      </div>

      <MobileBottomNav onMore={() => setSidebarOpen((v) => !v)} />

      <CheckInGate />
    </div>
  );
}
