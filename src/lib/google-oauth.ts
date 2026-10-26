import type { HealthSession } from "./session";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export const SCOPES = [
  "https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly",
  "https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly",
  "https://www.googleapis.com/auth/googlehealth.sleep.readonly",
  "https://www.googleapis.com/auth/googlehealth.nutrition.readonly",
];

export function appUrl() {
  const url =
    process.env.APP_URL ||
    // On Vercel, default to the production domain so one-click deploys need no extra config.
    (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`) ||
    "http://localhost:3000";
  return url.replace(/\/$/, "");
}

export function redirectUri() {
  return `${appUrl()}/api/auth/callback`;
}

export function buildAuthUrl(state: string) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    // Force the consent screen so Google always returns a refresh token.
    prompt: "consent",
    state,
  });
  return `${AUTH_URL}?${params}`;
}

type TokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  error?: string;
  error_description?: string;
};

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      ...body,
    }),
    cache: "no-store",
  });
  const json = (await res.json()) as TokenResponse;
  if (!res.ok) {
    throw new Error(
      `Google token error (${json.error ?? res.status}): ${json.error_description ?? ""}`,
    );
  }
  return json;
}

export async function exchangeCode(code: string) {
  return tokenRequest({ code, grant_type: "authorization_code", redirect_uri: redirectUri() });
}

/**
 * Returns a valid access token, refreshing it (and mutating the session) when
 * it is about to expire. Callers must `session.save()` afterwards.
 */
export async function ensureAccessToken(session: HealthSession): Promise<string> {
  if (session.accessToken && session.expiresAt && session.expiresAt - Date.now() > 60_000) {
    return session.accessToken;
  }
  if (!session.refreshToken) throw new Error("Not signed in");
  const tokens = await tokenRequest({
    refresh_token: session.refreshToken,
    grant_type: "refresh_token",
  });
  session.accessToken = tokens.access_token;
  session.expiresAt = Date.now() + tokens.expires_in * 1000;
  if (tokens.refresh_token) session.refreshToken = tokens.refresh_token;
  return tokens.access_token;
}
