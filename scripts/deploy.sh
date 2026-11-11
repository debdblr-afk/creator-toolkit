#!/bin/sh
# Build the site and publish dist/ to the gh-pages branch (GitHub Pages serves that branch).
#
# The custom domain in public/CNAME is only published once its DNS record points at
# GitHub Pages; until then the site stays reachable on the default github.io address.
# Set PAGES_DOMAIN=1 to publish with the custom domain regardless (for example behind a DNS proxy).
set -e

REMOTE=$(git remote get-url origin)
NAME=$(git config user.name)
EMAIL=$(git config user.email)
REV=$(git rev-parse --short HEAD)

npm run build

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
cp -R dist/. "$TMP"/
touch "$TMP/.nojekyll"

DOMAIN=$(tr -d '[:space:]' < public/CNAME 2>/dev/null || true)
if [ "$PAGES_DOMAIN" = "1" ]; then
  echo "Publishing with the custom domain $DOMAIN (forced)."
elif [ -n "$DOMAIN" ] && command -v dig >/dev/null 2>&1 && dig +short "$DOMAIN" CNAME | grep -q 'github\.io\.$'; then
  echo "$DOMAIN points at GitHub Pages: publishing with the custom domain."
else
  rm -f "$TMP/CNAME"
  echo "$DOMAIN does not point at GitHub Pages yet: publishing without the custom domain."
fi

git -C "$TMP" init -q -b gh-pages
git -C "$TMP" add -A
git -C "$TMP" -c user.name="$NAME" -c user.email="$EMAIL" commit -q -m "Deploy $REV"
git -C "$TMP" push -q -f "$REMOTE" gh-pages

echo "Published $REV to the gh-pages branch."
