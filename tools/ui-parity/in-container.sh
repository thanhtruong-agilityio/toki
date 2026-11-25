#!/usr/bin/env bash
# Runs inside the Playwright container (TOKI-109). Started by container.mjs, never by hand.
set -euo pipefail

[ "${TOKI_PARITY_CONTAINER:-}" = "1" ] || { echo "parity: run through pnpm test:e2e:parity"; exit 1; }

# Work on a copy, so that the Linux install does not touch the host's node_modules.
# The container runs as the user, so the copy lives in /tmp (a folder at the root is not writable).
WORK=/tmp/work
mkdir -p "$WORK" "$HOME"
tar -C /repo --exclude=node_modules --exclude=.git --exclude=e2e/assets -cf - . | tar -C "$WORK" -xf -
cd "$WORK"

# The image has Node 26 and no corepack; the repository asks for Node 22 (devEngines, onFail error).
# Decided by Thanh Truong on 2026-11-24: run the image's Node and relax the check in this copy only.
node -e "const fs=require('fs'),p=JSON.parse(fs.readFileSync('package.json','utf8'));p.devEngines.runtime.onFail='warn';fs.writeFileSync('package.json',JSON.stringify(p,null,2))"
npm install --silent --prefix /pnpm-store/tool pnpm@12.21.0
export PATH="/pnpm-store/tool/node_modules/.bin:$PATH"
pnpm install --frozen-lockfile --store-dir /pnpm-store/store

# The image must hold the Chromium that this Playwright needs (R8): it refuses to go on when the image
# is of another Playwright version than the lockfile.
node tools/ui-parity/check-image.mjs

if [ "${PARITY_MODE}" = "reference" ]; then export PARITY_REFERENCE=1 PARITY_REFERENCE_DIR=/ref; fi
PARITY_OUT=/out pnpm exec playwright test -c playwright.parity.config.ts ${PARITY_ARGS:-}
