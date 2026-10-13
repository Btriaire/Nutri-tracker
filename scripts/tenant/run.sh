#!/bin/sh
# Usage : scripts/tenant/run.sh <route.ts> [...]
# Convertit les routes, puis verifie le typage et liste ce qui reste a la main.
set -e
cd "$(dirname "$0")/../.."
python3 scripts/tenant/tenantize.py "$@"
echo "--- typage (les USER manquants apparaissent ici) ---"
npx tsc --noEmit -p . && echo "tsc OK"
echo "--- chemins proprietaire restants ---"
grep -rn "users/owner\|\"owner\"" app/api app/lib app/*/page.tsx 2>/dev/null | grep -v tenant || echo "aucun"
