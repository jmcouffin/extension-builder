#!/usr/bin/env bash
# Publish to the `build` branch that GitHub Pages serves, keeping the site
# root and every pull-request preview side by side:
#
#   build/            the live site, built from main
#   build/pr-<n>/     the preview of pull request <n>
#
#   publish-pages.sh main          dist/ becomes the root; previews are kept
#   publish-pages.sh pr <n>        dist/ becomes pr-<n>/; the root is kept
#   publish-pages.sh cleanup <n>   pr-<n>/ is removed; everything else is kept
#
# Each run assembles the whole site and force-pushes it as a single commit,
# so the branch never grows and stale hashed assets never pile up. Runs must
# not overlap: the workflows share one concurrency group for this.
#
# Needs GITHUB_TOKEN (contents: write) and GITHUB_REPOSITORY; GITHUB_SHA is
# used for the commit message.
set -euo pipefail

mode="${1:?usage: publish-pages.sh main|pr <n>|cleanup <n>}"
pr="${2:-}"
case "$mode" in
  main) ;;
  pr | cleanup) [[ "$pr" =~ ^[0-9]+$ ]] || { echo "a pull request number is required" >&2; exit 2; } ;;
  *) echo "unknown mode: $mode" >&2; exit 2 ;;
esac

# PAGES_REMOTE overrides the target, for trying the script against a local repo.
remote="${PAGES_REMOTE:-https://x-access-token:${GITHUB_TOKEN:-}@github.com/${GITHUB_REPOSITORY:-}.git}"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/old" "$work/site"

if git ls-remote --exit-code --heads "$remote" build >/dev/null 2>&1; then
  git clone --quiet --depth 1 --branch build "$remote" "$work/old"
  rm -rf "$work/old/.git"
fi

# Previews always survive; the one being replaced or removed is dropped below.
shopt -s nullglob
for dir in "$work"/old/pr-*/; do
  cp -R "$dir" "$work/site/"
done

copy_root() {
  # Everything at the root of the current site except the previews.
  (
    cd "$work/old"
    for entry in * .[!.]*; do
      [[ "$entry" == pr-* ]] && continue
      cp -R "$entry" "$work/site/"
    done
  )
}

case "$mode" in
  main)
    cp -R dist/. "$work/site/"
    message="Build from ${GITHUB_SHA:-unknown}"
    ;;
  pr)
    copy_root
    rm -rf "$work/site/pr-$pr"
    mkdir -p "$work/site/pr-$pr"
    cp -R dist/. "$work/site/pr-$pr/"
    # Only the root may claim the custom domain.
    rm -f "$work/site/pr-$pr/CNAME"
    message="Preview of #$pr from ${GITHUB_SHA:-unknown}"
    ;;
  cleanup)
    copy_root
    rm -rf "$work/site/pr-$pr"
    message="Remove the preview of #$pr"
    ;;
esac

touch "$work/site/.nojekyll"

cd "$work/site"
git init --quiet --initial-branch build
git config user.name "github-actions[bot]"
git config user.email "github-actions[bot]@users.noreply.github.com"
git add --all
git commit --quiet --message "$message"
git push --quiet --force "$remote" build
echo "Published ($mode${pr:+ #$pr})."
