import { useState } from "react";
import { useAuth } from "../lib/AuthContext";
import { OWNER_EMAIL } from "../lib/supabaseClient";
import { LogoMark, EyeIcon, EyeOffIcon } from "./icons";

export default function LoginScreen() {
  const { sendMagicLink, signInWithPassword } = useAuth();
  const [mode, setMode] = useState("password"); // password | magic
  const [email, setEmail] = useState(OWNER_EMAIL);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | sent | error
  const [errorMessage, setErrorMessage] = useState("");

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    setSigningIn(true);
    setPasswordError("");
    const { error } = await signInWithPassword(email, password);
    if (error) {
      // A wrong password and an unknown email get the same message on purpose.
      // Anything that isn't a credentials failure (rate limit, network) says so.
      setPasswordError(error.status === 400 ? "Incorrect email or password" : error.message);
      setSigningIn(false);
    }
    // On success AuthContext's onAuthStateChange swaps this screen out.
  }

  function switchMode(next) {
    setMode(next);
    setStatus("idle");
    setErrorMessage("");
    setPasswordError("");
  }

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
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
            style={{ background: "linear-gradient(135deg, #3b82f6, #7c3aed)" }}
          >
            <LogoMark className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-xl font-medium text-white tracking-tight">
            Mission Control
          </h1>
          <p className="text-sm text-ink-secondary mt-1">
            Ultra Power Industrial Resources, Inc.
          </p>
        </div>

        <div className="bg-base-900 border-[0.5px] border-line rounded-[10px] p-6">
          {status === "sent" ? (
            <div className="text-center py-2">
              <p className="text-white font-medium mb-1">Check your inbox</p>
              <p className="text-sm text-ink-secondary">
                A sign-in link was sent to <span className="text-white">{email}</span>.
              </p>
              <button
                onClick={() => setStatus("idle")}
                className="mt-4 text-sm text-accent hover:text-accent-light"
              >
                Use a different email
              </button>
            </div>
          ) : mode === "password" ? (
            <>
              <form onSubmit={handlePasswordSubmit}>
                <label className="block text-xs font-medium text-ink-secondary mb-2">
                  Email address
                </label>
                <input
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input"
                  placeholder="you@company.com"
                />
                <label className="block text-xs font-medium text-ink-secondary mt-4 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input"
                    style={{ paddingRight: 40 }}
                    placeholder="Password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 right-0 px-3 flex items-center text-ink-muted hover:text-white"
                  >
                    {showPassword ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                  </button>
                </div>
                {passwordError && (
                  <p role="alert" className="mt-2 text-sm text-red-600">{passwordError}</p>
                )}
                <button
                  type="submit"
                  disabled={signingIn}
                  className="mt-4 w-full rounded-[10px] bg-accent hover:bg-accent-light disabled:opacity-60 text-base-950 font-medium text-sm py-2.5 transition-colors"
                >
                  {signingIn ? "Signing in…" : "Sign In"}
                </button>
              </form>
              <div className="flex items-center gap-3 my-4" aria-hidden="true">
                <div className="flex-1 h-px bg-line" />
                <span className="text-xs text-ink-muted">OR</span>
                <div className="flex-1 h-px bg-line" />
              </div>
              <button
                type="button"
                onClick={() => switchMode("magic")}
                className="block mx-auto text-xs text-accent hover:text-accent-light"
              >
                Sign in with magic link
              </button>
            </>
          ) : (
            <form onSubmit={handleSubmit}>
              <label className="block text-xs font-medium text-ink-secondary mb-2">
                Email address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="you@company.com"
              />
              {status === "error" && (
                <p className="mt-2 text-sm text-red-600">{errorMessage}</p>
              )}
              <button
                type="submit"
                disabled={status === "sending"}
                className="mt-4 w-full rounded-[10px] bg-accent hover:bg-accent-light disabled:opacity-60 text-base-950 font-medium text-sm py-2.5 transition-colors"
              >
                {status === "sending" ? "Sending link…" : "Send magic link"}
              </button>
              <button
                type="button"
                onClick={() => switchMode("password")}
                className="block mx-auto mt-4 text-xs text-accent hover:text-accent-light"
              >
                Sign in with password
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
