// The one thing app.json cannot say: WHERE ON ITS WEBSITE the web build lives.
// The game has its own site, polygroveapp.com, and sits at the top of it, so the base is
// empty. (Until 2026-11-23 a second copy was served from inside the PolygroveDB site under
// /app; POLYGROVE_WEB_BASE=/app built that one, and still would.) Everything else stays in
// app.json.
module.exports = ({ config }) => ({
  ...config,
  experiments: { ...config.experiments, baseUrl: process.env.POLYGROVE_WEB_BASE || '' },
});
