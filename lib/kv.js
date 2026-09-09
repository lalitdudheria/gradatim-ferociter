// Thin wrapper over the Upstash Redis REST API (works with both the
// "Upstash for Redis" and legacy "Vercel KV" integrations, which inject
// differently-named env vars for the same REST protocol).

function kvConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    throw new Error("Redis REST env vars are not configured");
  }
  return { url, token };
}

async function kvCommand(...command) {
  const { url, token } = kvConfig();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });
  if (!res.ok) {
    throw new Error(`Redis command failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.result;
}

async function kvGetJSON(key) {
  const raw = await kvCommand("GET", key);
  return raw ? JSON.parse(raw) : null;
}

async function kvSetJSON(key, value, ttlSeconds) {
  if (ttlSeconds) {
    await kvCommand("SET", key, JSON.stringify(value), "EX", String(ttlSeconds));
  } else {
    await kvCommand("SET", key, JSON.stringify(value));
  }
}

async function kvDel(key) {
  await kvCommand("DEL", key);
}

module.exports = { kvCommand, kvGetJSON, kvSetJSON, kvDel };
