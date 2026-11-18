// The one thing app.json cannot say: WHERE ON ITS WEBSITE the web build lives.
// The game has its own site (polygroveapp.com, 2026-11-17) and sits at the top of it, so the
// base is empty. Until that address is connected the game is also still served from inside
// the PolygroveDB site, under /app: scripts/deploy-web.sh builds that copy with
// POLYGROVE_WEB_BASE=/app. Everything else stays in app.json.
module.exports = ({ config }) => ({
  ...config,
  experiments: { ...config.experiments, baseUrl: process.env.POLYGROVE_WEB_BASE || '' },
});
