const { kvGetJSON, kvSetJSON } = require("./kv");

const AUTH_URL = "https://api.prod.whoop.com/oauth/oauth2/auth";
const TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";
const API_BASE = "https://api.prod.whoop.com/developer";
const SCOPES = "offline read:recovery read:cycles read:sleep";
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

module.exports = {
  TOKENS_KEY,
  buildAuthorizeUrl,
  exchangeCode,
  getValidAccessToken,
  whoopGet,
};
