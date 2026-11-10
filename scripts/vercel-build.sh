#!/usr/bin/env bash
# Build used by Vercel. Creates or updates database tables when a database is connected;
# otherwise still builds, and /setup reports that the database is missing.
set -euo pipefail
npx prisma generate
if [ -n "${DATABASE_URL:-}" ] && [ -n "${DATABASE_URL_UNPOOLED:-}" ]; then
  npx prisma db push --skip-generate
else
  echo "No database connected yet: skipping table setup. Connect one, then redeploy."
fi
npx next build
