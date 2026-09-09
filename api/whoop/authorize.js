const crypto = require("crypto");
const { buildAuthorizeUrl } = require("../../lib/whoop");
const { kvSetJSON } = require("../../lib/kv");

// One-time entry point the owner visits by hand to grant this app access
// to their WHOOP data. Gated by SETUP_KEY so a random visitor can't kick
// off the consent flow.
module.exports = async (req, res) => {
  if (req.query.key !== process.env.SETUP_KEY) {
    res.status(403).send("Forbidden");
    return;
  }

  const state = crypto.randomBytes(16).toString("hex");
  await kvSetJSON(`whoop:state:${state}`, { createdAt: Date.now() }, 300);

  res.writeHead(302, { Location: buildAuthorizeUrl(state) });
  res.end();
};
