import { useEffect, useState } from "react";
import { useAuth } from "../lib/AuthContext";
import {
  isGoogleAuthConfigured,
  requestAuthCode,
  disconnectGoogleCalendar,
  adoptAccessToken,
} from "../lib/googleAuth";
import { fetchCalendarConnection, connectWithCode, disconnectCalendar } from "../lib/googleCalendarToken";
import Toast, { useToast } from "../components/Toast";
import { fetchFxRate, updateFxRate, DEFAULT_FX_RATE } from "../lib/settings";
import { fetchBlacklistedSuppliers, addSupplierToBlacklist, removeSupplierFromBlacklist } from "../lib/sourcing";
import { PageHeader, Card, CardHeader, Badge, Button } from "../components/ui";

export default function Settings() {
  const { user } = useAuth();
  // Connection lives server-side (refresh token), so it's the same on every device.
  const [connection, setConnection] = useState(null);
  const connected = Boolean(connection?.connected);
  const [toast, showToast] = useToast();
  const calendarId = import.meta.env.VITE_GOOGLE_CALENDAR_ID;
  const loadConnection = () => fetchCalendarConnection().then(setConnection).catch(() => setConnection(null));
  useEffect(() => {
    loadConnection();
  }, []);
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
      const code = await requestAuthCode();
      const { access_token, expiry } = await connectWithCode(code);
      adoptAccessToken(access_token, expiry);
      await loadConnection();
      showToast("Google Calendar connected");
    } catch (err) {
      setStatus({ type: "error", message: err.message ?? "Couldn't connect Google Calendar." });
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    setStatus(null);
    try {
      await disconnectCalendar();
      disconnectGoogleCalendar();
      setConnection(null);
      setStatus({ type: "success", message: "Google Calendar disconnected." });
    } catch (err) {
      setStatus({ type: "error", message: err.message ?? "Couldn't disconnect." });
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <PageHeader title="Account & Integrations" />
      <Toast toast={toast} />

      <Card noPadding>
        <CardHeader title="Account" />
        <div className="px-5 py-4">
          <p className="text-sm text-ink-secondary">Signed in as {user?.email}</p>
        </div>
      </Card>

      <Card noPadding>
        <CardHeader title="Pricing" />
        <div className="px-5 py-4">
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
            <Button type="submit" variant="primary" disabled={savingFx}>
              {savingFx ? "Saving…" : "Save"}
            </Button>
          </form>
          {fxStatus && (
            <p className={`text-xs mt-3 ${fxStatus.type === "error" ? "text-red-600" : "text-emerald-700"}`}>
              {fxStatus.message}
            </p>
          )}
        </div>
      </Card>

      <Card noPadding>
        <CardHeader
          title="Google Calendar"
          action={
            <Badge variant={connected ? "green" : "gray"}>{connected ? "Connected" : "Not connected"}</Badge>
          }
        />
        <div className="px-5 py-4">
          <p className="text-sm text-ink-secondary mb-4">
            Connect your Google Calendar to show events in the Mission Control weekly plan.
          </p>

          {!isGoogleAuthConfigured() ? (
            <p className="text-xs text-orange-600/80 bg-orange-500/10 border border-orange-500/20 rounded-[10px] px-3 py-2">
              VITE_GOOGLE_CLIENT_ID is not set.
            </p>
          ) : connected ? (
            <div className="space-y-3">
              <div className="text-xs text-ink-secondary space-y-1">
                <p>
                  Calendar: <span className="text-white font-medium">{calendarId || "not configured"}</span>
                </p>
                <p>
                  Last synced:{" "}
                  {connection.lastSynced
                    ? connection.lastSynced.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })
                    : "not yet — open the homepage to sync"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={handleDisconnect}>
                  Disconnect Google Calendar
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="primary" onClick={handleConnect} disabled={connecting}>
              {connecting ? "Connecting…" : "Connect Google Calendar"}
            </Button>
          )}

          {status && (
            <p className={`text-xs mt-3 ${status.type === "error" ? "text-red-600" : "text-emerald-700"}`}>
              {status.message}
            </p>
          )}
        </div>
      </Card>

      <Card noPadding>
        <CardHeader title="Supplier Blacklist" />
        <div className="px-5 py-4">
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
              className="input flex-1 min-w-0"
            />
            <Button type="submit" variant="danger" className="!bg-red-500/10 !text-red-600" disabled={savingBlacklist}>
              {savingBlacklist ? "Adding…" : "Add"}
            </Button>
          </form>
          {blacklistError && <p className="text-xs text-red-600 mt-2">{blacklistError}</p>}
        </div>
      </Card>
    </div>
  );
}
