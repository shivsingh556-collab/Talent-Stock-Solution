#!/usr/bin/env bash
# Fail CI if high-risk secrets appear in the current tree.
# The Supabase anon/publishable key in backend/config.js is expected and not matched.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

PATTERNS='AIza[0-9A-Za-z_-]{35}|-----BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY-----|sk_live_[0-9A-Za-z]+|xai-[A-Za-z0-9]{20,}'

if git grep -I -nE "$PATTERNS" -- \
  ':!scripts/check-no-secrets.sh' \
  ':!.github/workflows/security.yml' \
  ':!SECURITY.md'; then
  echo "Possible committed secret detected. Remove it and rotate the credential." >&2
  exit 1
fi

if git grep -I -nE 'service_role' -- ':!SECURITY.md' ':!BACKEND_SETUP.md' ':!scripts/check-no-secrets.sh' | grep -E 'eyJ[A-Za-z0-9_-]{10,}'; then
  echo "Possible service_role JWT detected." >&2
  exit 1
fi

echo "No high-risk secret patterns in the working tree."
