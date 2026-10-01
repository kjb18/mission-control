// Google Calendar OAuth via Google Identity Services' token-client flow.
//
// Deliberately does NOT use VITE_GOOGLE_CLIENT_SECRET. Client secrets exist
// to authenticate a *confidential* client (a server, which can keep a
// secret) during the Authorization Code exchange. Mission Control is a
// static SPA with no backend — every VITE_ variable ships in the public JS
// bundle, so a "secret" there isn't secret at all. Google's own guidance
// for browser apps is this token-client (implicit-style) flow: it returns
// an access token directly to the page after user consent, authenticated
// only by the Client ID + the page's origin (which must be registered in
// Google Cloud Console under the OAuth Client's "Authorized JavaScript
// origins"). No secret changes that.
//
// Trade-off: tokens from this flow are short-lived (~1 hour) and there is
// no refresh token (refresh tokens only come from the server-side
// Authorization Code flow). There is also no truly silent renewal: even
// prompt: "" opens Google's popup. So the token is kept in localStorage to
// survive page refreshes for its lifetime, and nothing except the Settings
// "Connect" button ever opens the popup. Once it expires, reads fall back
// to the API-key proxy and pushes are skipped until the user reconnects.

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPE = "https://www.googleapis.com/auth/calendar.events";
const STORAGE_KEY = "mc:google:connected";
const TOKEN_KEY = "mc:google:token";

let tokenClient = null;
let accessToken = null;
let tokenExpiresAt = 0;

function restoreToken() {
  try {
    const saved = JSON.parse(localStorage.getItem(TOKEN_KEY));
    if (saved?.token && Date.now() < saved.expiresAt) {
      accessToken = saved.token;
      tokenExpiresAt = saved.expiresAt;
    }
  } catch {
    /* ignore */
  }
}
restoreToken();

function ensureTokenClient() {
  if (tokenClient) return tokenClient;
  if (!window.google?.accounts?.oauth2) {
    throw new Error("Google Identity Services hasn't loaded yet.");
  }
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPE,
    callback: () => {}, // overridden per-call below
  });
  return tokenClient;
}

export function isGoogleAuthConfigured() {
  return Boolean(CLIENT_ID);
}

export function hasConnectedBefore() {
  return localStorage.getItem(STORAGE_KEY) === "true";
}

/**
 * Returns a currently-valid access token, or null if none is cached.
 * Never prompts the user — use connectGoogleCalendar() for that.
 */
export function getAccessToken() {
  if (accessToken && Date.now() < tokenExpiresAt) return accessToken;
  return null;
}

/**
 * Requests an access token. `interactive: true` shows the Google consent
 * popup (use for the Settings "Connect" button); `interactive: false`
 * attempts a silent, no-popup renewal (use for background push attempts)
 * and resolves to null instead of prompting if that isn't possible.
 */
export function requestAccessToken({ interactive } = { interactive: true }) {
  return new Promise((resolve, reject) => {
    try {
      const client = ensureTokenClient();
      client.callback = (response) => {
        if (response.error) {
          if (!interactive) {
            resolve(null);
            return;
          }
          reject(new Error(response.error_description || response.error));
          return;
        }
        accessToken = response.access_token;
        tokenExpiresAt = Date.now() + (Number(response.expires_in) || 3600) * 1000 - 30_000;
        localStorage.setItem(STORAGE_KEY, "true");
        localStorage.setItem(TOKEN_KEY, JSON.stringify({ token: accessToken, expiresAt: tokenExpiresAt }));
        resolve(accessToken);
      };
      client.requestAccessToken({ prompt: interactive ? "consent" : "" });
    } catch (err) {
      if (!interactive) {
        resolve(null);
      } else {
        reject(err);
      }
    }
  });
}

/**
 * Access token for API calls, or null when there is no unexpired token.
 * Never renews on its own: a "silent" renewal still opens Google's popup,
 * which showed up as a surprise sign-in prompt on unrelated clicks.
 */
export async function getOrRenewAccessToken() {
  return getAccessToken();
}

/**
 * Authorization-code flow (popup). Resolves to a one-time code that the
 * google-calendar-auth Edge Function exchanges for access + refresh tokens,
 * so the connection keeps working after the access token expires.
 */
export function requestAuthCode() {
  return new Promise((resolve, reject) => {
    if (!window.google?.accounts?.oauth2?.initCodeClient) {
      reject(new Error("Google Identity Services hasn't loaded yet."));
      return;
    }
    const client = window.google.accounts.oauth2.initCodeClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      ux_mode: "popup",
      callback: (response) => {
        if (response.error) reject(new Error(response.error_description || response.error));
        else resolve(response.code);
      },
      error_callback: (err) => reject(new Error(err?.message || err?.type || "Google sign-in was closed.")),
    });
    client.requestCode();
  });
}

export function getClientId() {
  return CLIENT_ID;
}

/** Expiry (epoch ms) of the token currently held, or 0. */
export function getTokenExpiry() {
  return accessToken ? tokenExpiresAt : 0;
}

/**
 * Take over a token obtained on another device (saved in app_settings), so
 * pushes such as createEvent work here too. Never prompts.
 */
export function adoptAccessToken(token, expiresAt) {
  if (!token || Date.now() >= expiresAt) return;
  accessToken = token;
  tokenExpiresAt = expiresAt;
  localStorage.setItem(STORAGE_KEY, "true");
  localStorage.setItem(TOKEN_KEY, JSON.stringify({ token, expiresAt }));
}

/** Connected before, but the token has expired — Settings offers Reconnect. */
export function needsReconnect() {
  return hasConnectedBefore() && !getAccessToken();
}

export function disconnectGoogleCalendar() {
  if (accessToken && window.google?.accounts?.oauth2?.revoke) {
    window.google.accounts.oauth2.revoke(accessToken, () => {});
  }
  accessToken = null;
  tokenExpiresAt = 0;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(TOKEN_KEY);
}
