const { exchangeCode } = require("../../lib/whoop");
const { kvGetJSON, kvDel } = require("../../lib/kv");

// Called by the frontend once, right after WHOOP redirects back to the
// site's root with ?code=...&state=.... Exchanges the code for tokens
// server-side (the client secret never reaches the browser) and stores
// them in Redis.
module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  let raw = "";
  for await (const chunk of req) raw += chunk;

  let code, state;
  try {
    ({ code, state } = JSON.parse(raw || "{}"));
  } catch {
    res.status(400).json({ error: "Invalid JSON body" });
    return;
  }

  if (!code || !state) {
    res.status(400).json({ error: "Missing code or state" });
    return;
  }

  const stateKey = `whoop:state:${state}`;
  const stored = await kvGetJSON(stateKey);
  if (!stored) {
    res.status(400).json({ error: "Invalid or expired state" });
    return;
  }
  await kvDel(stateKey);

  try {
    await exchangeCode(code);
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String((err && err.message) || err) });
  }
};
