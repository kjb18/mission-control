import { useState } from "react";
import { useAuth } from "../lib/AuthContext";
import { OWNER_EMAIL } from "../lib/supabaseClient";

export default function LoginScreen() {
  const { sendMagicLink } = useAuth();
  const [email, setEmail] = useState(OWNER_EMAIL);
  const [status, setStatus] = useState("idle"); // idle | sending | sent | error
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("sending");
    setErrorMessage("");
    const { error } = await sendMagicLink(email);
    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }
    setStatus("sent");
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-base-950 px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <img src="/pwa-192x192.png" alt="" className="w-16 h-16 rounded-2xl mb-4" />
          <h1 className="text-xl font-semibold text-white tracking-tight">
            Mission Control
          </h1>
          <p className="text-sm text-white/50 mt-1">
            Ultra Power Industrial Resources, Inc.
          </p>
        </div>

        <div className="bg-base-900 border border-white/10 rounded-2xl p-6">
          {status === "sent" ? (
            <div className="text-center py-2">
              <p className="text-white font-medium mb-1">Check your inbox</p>
              <p className="text-sm text-white/50">
                A sign-in link was sent to <span className="text-white/80">{email}</span>.
              </p>
              <button
                onClick={() => setStatus("idle")}
                className="mt-4 text-sm text-accent hover:text-accent-light"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <label className="block text-xs font-medium text-white/60 mb-2">
                Email address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg bg-base-800 border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="you@company.com"
              />
              {status === "error" && (
                <p className="mt-2 text-sm text-red-400">{errorMessage}</p>
              )}
              <button
                type="submit"
                disabled={status === "sending"}
                className="mt-4 w-full rounded-lg bg-accent hover:bg-accent-light disabled:opacity-60 text-base-950 font-medium text-sm py-2.5 transition-colors"
              >
                {status === "sending" ? "Sending link…" : "Send magic link"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
