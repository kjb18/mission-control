import { useEffect, useState } from "react";
import { useAuth } from "../lib/AuthContext";
import {
  isGoogleAuthConfigured,
  hasConnectedBefore,
  requestAccessToken,
  disconnectGoogleCalendar,
} from "../lib/googleAuth";
import { fetchFxRate, updateFxRate, DEFAULT_FX_RATE } from "../lib/settings";
import { fetchBlacklistedSuppliers, addSupplierToBlacklist, removeSupplierFromBlacklist } from "../lib/sourcing";

export default function Settings() {
  const { user } = useAuth();
  const [connected, setConnected] = useState(hasConnectedBefore());
  const [status, setStatus] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [fxRateInput, setFxRateInput] = useState(String(DEFAULT_FX_RATE));
  const [fxStatus, setFxStatus] = useState(null);
  const [savingFx, setSavingFx] = useState(false);
  const [blacklist, setBlacklist] = useState([]);
  const [blacklistInput, setBlacklistInput] = useState("");
  const [blacklistError, setBlacklistError] = useState(null);
  const [savingBlacklist, setSavingBlacklist] = useState(false);

  function loadBlacklist() {
    fetchBlacklistedSuppliers().then(setBlacklist).catch((e) => setBlacklistError(e.message));
  }

  useEffect(() => {
    fetchFxRate()
      .then((rate) => setFxRateInput(String(rate)))
      .catch(() => {});
    loadBlacklist();
  }, []);

  async function handleAddToBlacklist(e) {
    e.preventDefault();
    if (!blacklistInput.trim()) return;
    setSavingBlacklist(true);
    setBlacklistError(null);
    try {
      await addSupplierToBlacklist(blacklistInput.trim());
      setBlacklistInput("");
      loadBlacklist();
    } catch (err) {
      setBlacklistError(err.message);
    } finally {
      setSavingBlacklist(false);
    }
  }

  async function handleRemoveFromBlacklist(supplier) {
    try {
      await removeSupplierFromBlacklist(supplier.id);
      loadBlacklist();
    } catch (err) {
      setBlacklistError(err.message);
    }
  }

  async function handleSaveFxRate(e) {
    e.preventDefault();
    const parsed = Number(fxRateInput);
    if (!parsed || parsed <= 0) {
      setFxStatus({ type: "error", message: "Enter a valid positive FX rate." });
      return;
    }
    setSavingFx(true);
    setFxStatus(null);
    try {
      await updateFxRate(parsed);
      setFxStatus({ type: "success", message: "FX rate updated." });
    } catch (err) {
      setFxStatus({ type: "error", message: err.message });
    } finally {
      setSavingFx(false);
    }
  }

  async function handleConnect() {
    setConnecting(true);
    setStatus(null);
    try {
      await requestAccessToken({ interactive: true });
      setConnected(true);
      setStatus({ type: "success", message: "Google Calendar connected." });
    } catch (err) {
      setStatus({ type: "error", message: err.message ?? "Couldn't connect Google Calendar." });
    } finally {
      setConnecting(false);
    }
  }

  function handleDisconnect() {
    disconnectGoogleCalendar();
    setConnected(false);
    setStatus({ type: "success", message: "Google Calendar disconnected." });
  }

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-6 py-10 space-y-8">
      <div>
        <p className="text-[11px] uppercase tracking-widest text-accent font-medium mb-1">
          Settings
        </p>
        <h1 className="text-2xl font-semibold text-white">Account & Integrations</h1>
      </div>

      <section className="rounded-[10px] border-[0.5px] border-line bg-base-900 px-3 py-2.5">
        <h2 className="text-sm font-semibold text-white mb-3">Account</h2>
        <p className="text-sm text-ink-secondary">Signed in as {user?.email}</p>
      </section>

      <section className="rounded-[10px] border-[0.5px] border-line bg-base-900 px-3 py-2.5">
        <h2 className="text-sm font-semibold text-white mb-3">Pricing</h2>
        <p className="text-sm text-ink-secondary mb-4">
          USD→PHP FX rate used for landed cost on the Sourcing Desk and Quote Builder.
        </p>
        <form onSubmit={handleSaveFxRate} className="flex items-end gap-2">
          <label className="block">
            <span className="block text-xs text-ink-secondary mb-1">FX Rate (PHP per USD)</span>
            <input
              type="number"
              step="0.01"
              value={fxRateInput}
              onChange={(e) => setFxRateInput(e.target.value)}
              className="input w-40"
            />
          </label>
          <button
            type="submit"
            disabled={savingFx}
            className="px-4 py-2 rounded-[10px] bg-accent hover:bg-accent-light disabled:opacity-60 text-base-950 text-sm font-medium"
          >
            {savingFx ? "Saving…" : "Save"}
          </button>
        </form>
        {fxStatus && (
          <p className={`text-xs mt-3 ${fxStatus.type === "error" ? "text-red-600" : "text-emerald-700"}`}>
            {fxStatus.message}
          </p>
        )}
      </section>

      <section className="rounded-[10px] border-[0.5px] border-line bg-base-900 px-3 py-2.5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white">Google Calendar</h2>
          <span
            className={`text-[11px] font-medium rounded-full px-2 py-0.5 ${
              connected ? "text-emerald-700 bg-emerald-400/15" : "text-ink-secondary bg-base-800/60"
            }`}
          >
            {connected ? "Connected" : "Not connected"}
          </span>
        </div>
        <p className="text-sm text-ink-secondary mb-4">
          Connect your Google account so time blocks you create in Mission Control push to
          Google Calendar with a 5-minute reminder, and so private calendar events can be read
          into the Weekly Plan and Month Calendar.
        </p>

        {!isGoogleAuthConfigured() ? (
          <p className="text-xs text-orange-600/80 bg-orange-500/10 border border-orange-500/20 rounded-[10px] px-3 py-2">
            VITE_GOOGLE_CLIENT_ID is not set.
          </p>
        ) : connected ? (
          <button
            onClick={handleDisconnect}
            className="px-4 py-2 rounded-[10px] bg-base-800 hover:bg-base-800/80 border-[0.5px] border-line-strong text-white text-sm font-medium"
          >
            Disconnect Google Calendar
          </button>
        ) : (
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="px-4 py-2 rounded-[10px] bg-accent hover:bg-accent-light disabled:opacity-60 text-base-950 text-sm font-medium"
          >
            {connecting ? "Connecting…" : "Connect Google Calendar"}
          </button>
        )}

        {status && (
          <p
            className={`text-xs mt-3 ${
              status.type === "error" ? "text-red-600" : "text-emerald-700"
            }`}
          >
            {status.message}
          </p>
        )}
      </section>

      <section className="rounded-[10px] border-[0.5px] border-line bg-base-900 px-3 py-2.5">
        <h2 className="text-sm font-semibold text-white mb-3">Supplier Blacklist</h2>
        <p className="text-sm text-ink-secondary mb-4">
          Blacklisted suppliers are blocked from outreach on the Sourcing Desk.
        </p>

        <ul className="space-y-1.5 mb-4">
          {blacklist.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between bg-base-800 border border-line rounded-[10px] px-3 py-2"
            >
              <span className="text-sm text-white">{s.name}</span>
              <button
                onClick={() => handleRemoveFromBlacklist(s)}
                className="text-xs text-ink-muted hover:text-red-600"
              >
                Remove
              </button>
            </li>
          ))}
          {blacklist.length === 0 && <li className="text-sm text-ink-muted">No blacklisted suppliers.</li>}
        </ul>

        <form onSubmit={handleAddToBlacklist} className="flex gap-2">
          <input
            value={blacklistInput}
            onChange={(e) => setBlacklistInput(e.target.value)}
            placeholder="Supplier name…"
            className="input flex-1"
          />
          <button
            type="submit"
            disabled={savingBlacklist}
            className="px-4 py-2 rounded-[10px] bg-red-500/10 hover:bg-red-500/20 disabled:opacity-60 text-red-600 text-sm font-medium"
          >
            {savingBlacklist ? "Adding…" : "Add"}
          </button>
        </form>
        {blacklistError && <p className="text-xs text-red-600 mt-2">{blacklistError}</p>}
      </section>
    </div>
  );
}
