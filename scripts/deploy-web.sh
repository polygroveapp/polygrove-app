#!/bin/sh
# THE APP AS A WEBSITE (user, 2026-10-08: "can we put this app up as a website").
# Exports the Expo web build and copies it into the PolygroveDB site as /app,
# so it is served from https://polygrovedb.pages.dev/app/ — the SAME origin as
# the map page and the data, which keeps the map iframe and every fetch simple.
# app.json sets web.output "single" and experiments.baseUrl "/app".
# The site's _redirects sends each app route to /app/index.html (the routes
# are listed one by one: a /app/* wildcard would also catch the script files).
# Run this, then deploy the site as usual from polygrovedb/explorer.
set -e
cd "$(dirname "$0")/.."
SITE=../polygrovedb/explorer
rm -rf dist
npx expo export -p web
rm -rf "$SITE/app"
mkdir -p "$SITE/app"
cp -R dist/. "$SITE/app/"
# Cloudflare Pages never uploads a folder called node_modules — and the build keeps
# its fonts in assets/node_modules. Without this the font URLs answer with the
# site's home page, the fonts never load and the app stays on a blank screen.
if [ -d "$SITE/app/assets/node_modules" ]; then
  mv "$SITE/app/assets/node_modules" "$SITE/app/assets/nm"
  for f in "$SITE"/app/_expo/static/js/web/*.js; do
    sed -i '' 's|assets/node_modules/|assets/nm/|g' "$f"
  done
fi
echo "copied to $SITE/app — now deploy the site"
