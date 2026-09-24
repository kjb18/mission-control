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
// Authorization Code flow). That's fine here — pushes happen while the
// user is actively using the app, not in the background — and this code
// silently re-requests a token when needed.

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPE = "https://www.googleapis.com/auth/calendar.events";
const STORAGE_KEY = "mc:google:connected";

let tokenClient = null;
let accessToken = null;
let tokenExpiresAt = 0;

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

/** Access token for API calls, silently renewing if the cached one expired. */
export async function getOrRenewAccessToken() {
  const cached = getAccessToken();
  if (cached) return cached;
  if (!hasConnectedBefore()) return null;
  return requestAccessToken({ interactive: false });
}

export function disconnectGoogleCalendar() {
  if (accessToken && window.google?.accounts?.oauth2?.revoke) {
    window.google.accounts.oauth2.revoke(accessToken, () => {});
  }
  accessToken = null;
  tokenExpiresAt = 0;
  localStorage.removeItem(STORAGE_KEY);
}
