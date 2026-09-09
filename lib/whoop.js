const { kvGetJSON, kvSetJSON } = require("./kv");

const AUTH_URL = "https://api.prod.whoop.com/oauth/oauth2/auth";
const TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";
const API_BASE = "https://api.prod.whoop.com/developer";
const SCOPES = "offline read:recovery read:cycles read:sleep read:workout";
const TOKENS_KEY = "whoop:tokens";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function buildAuthorizeUrl(state) {
  const params = new URLSearchParams({
    client_id: requireEnv("WHOOP_CLIENT_ID"),
    redirect_uri: requireEnv("WHOOP_REDIRECT_URI"),
    response_type: "code",
    scope: SCOPES,
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

async function tokenRequest(body) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    throw new Error(`WHOOP token request failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function exchangeCode(code) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: requireEnv("WHOOP_REDIRECT_URI"),
    client_id: requireEnv("WHOOP_CLIENT_ID"),
    client_secret: requireEnv("WHOOP_CLIENT_SECRET"),
  });
  const tokens = await tokenRequest(body);
  await kvSetJSON(TOKENS_KEY, {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: Date.now() + tokens.expires_in * 1000,
  });
}

async function refreshTokens(refreshToken) {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: requireEnv("WHOOP_CLIENT_ID"),
    client_secret: requireEnv("WHOOP_CLIENT_SECRET"),
    scope: SCOPES,
  });
  const tokens = await tokenRequest(body);
  const updated = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: Date.now() + tokens.expires_in * 1000,
  };
  await kvSetJSON(TOKENS_KEY, updated);
  return updated;
}

async function getValidAccessToken() {
  const tokens = await kvGetJSON(TOKENS_KEY);
  if (!tokens) return null;

  const isExpiring = Date.now() >= tokens.expires_at - 60_000;
  if (!isExpiring) return tokens.access_token;

  const refreshed = await refreshTokens(tokens.refresh_token);
  return refreshed.access_token;
}

async function whoopGet(path, accessToken) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`WHOOP API request failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

function pad(n) {
  return String(n).padStart(2, "0");
}

// WHOOP timestamps are UTC; each record also carries the offset of the
// user's local timezone at the time, which is what determines which
// calendar day the workout actually falls on for the user.
function localDateKeyFromTimestamp(startIso, timezoneOffset) {
  const utcMs = new Date(startIso).getTime();
  const offset = timezoneOffset || "+00:00";
  const sign = offset.startsWith("-") ? -1 : 1;
  const [oh, om] = offset.slice(1).split(":").map(Number);
  const offsetMs = sign * (oh * 60 + om) * 60 * 1000;
  const local = new Date(utcMs + offsetMs);
  return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}`;
}

// Returns { "YYYY-MM-DD": { sport, durationMinutes } } for every workout
// logged since `sinceDate`, keyed by the user's local day.
async function fetchRecentWorkouts(accessToken, sinceDate) {
  const workouts = {};
  let nextToken;
  let pages = 0;

  do {
    const params = new URLSearchParams({ start: sinceDate.toISOString(), limit: "25" });
    if (nextToken) params.set("nextToken", nextToken);

    const page = await whoopGet(`/v2/activity/workout?${params.toString()}`, accessToken);
    for (const record of page.records || []) {
      const key = localDateKeyFromTimestamp(record.start, record.timezone_offset);
      if (!workouts[key]) {
        const durationMinutes = Math.round((new Date(record.end) - new Date(record.start)) / 60000);
        workouts[key] = { sport: record.sport_name || "Workout", durationMinutes };
      }
    }
    nextToken = page.next_token;
    pages += 1;
  } while (nextToken && pages < 4);

  return workouts;
}

module.exports = {
  TOKENS_KEY,
  buildAuthorizeUrl,
  exchangeCode,
  getValidAccessToken,
  whoopGet,
  fetchRecentWorkouts,
};
