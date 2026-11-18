#!/bin/sh
# THE GAME'S OWN WEBSITE (user, 2026-11-17: "the DB should be the DB and the app should be
# polygroveapp"). Exports the Expo web build for the TOP of a site and uploads it to the
# Cloudflare Pages project `polygroveapp` — polygroveapp.pages.dev, and polygroveapp.com once
# that address is connected. It is a single-page app with no 404.html, so Pages answers every
# route with index.html and the app's router does the rest (no _redirects needed here).
# The game still reads its data and its map page from the PolygroveDB site.
set -e
cd "$(dirname "$0")/.."
rm -rf dist
POLYGROVE_WEB_BASE= npx expo export -p web
# Cloudflare Pages never uploads a folder called node_modules — and the build keeps
# its fonts in assets/node_modules. Without this the fonts never load and the app stays blank.
if [ -d dist/assets/node_modules ]; then
  mv dist/assets/node_modules dist/assets/nm
  for f in dist/_expo/static/js/web/*.js; do
    sed -i '' 's|assets/node_modules/|assets/nm/|g' "$f"
  done
fi
npx -y wrangler@3 pages deploy dist --project-name polygroveapp --branch main --commit-dirty=true
