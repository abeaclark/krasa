#!/usr/bin/env bash
#
# End-to-end check of the lead-document upload flow.
#
#   ./scripts/test-upload.sh                          # against production
#   ./scripts/test-upload.sh http://localhost:3000    # against a local dev server
#   ./scripts/test-upload.sh https://www.krasadev.com ~/Downloads/real.pdf
#
# Exercises the path that matters: mint a signed URL, then PUT a file LARGER
# than Vercel's 4.5MB function body limit straight to Supabase Storage. If this
# passes, the whole reason the signed-URL flow exists is verified.
#
# Needs: bash, curl, python3 (all stock on macOS).

set -uo pipefail

BASE="${1:-https://www.krasadev.com}"
FILE="${2:-}"
SITE="refundauto.com"
# Any UUID works — it's just the storage folder name.
REF="9f3c1111-2222-4333-8444-555566667777"

cleanup() { [[ -n "${TMPFILE:-}" ]] && rm -f "$TMPFILE"; }
trap cleanup EXIT

if [[ -z "$FILE" ]]; then
  # 8MB of zeroes. Supabase checks the declared Content-Type against the
  # bucket's allowed_mime_types, not the file's magic bytes, so this is a valid
  # test of the size path.
  TMPFILE="$(mktemp -t leaddoc).pdf"
  dd if=/dev/zero of="$TMPFILE" bs=1024 count=8192 2>/dev/null
  FILE="$TMPFILE"
  echo "→ generated an 8MB test file (over Vercel's 4.5MB limit)"
elif [[ ! -f "$FILE" ]]; then
  echo "✗ no such file: $FILE" >&2
  exit 1
fi

SIZE=$(wc -c < "$FILE" | tr -d ' ')
echo "→ base: $BASE"
echo "→ file: $FILE ($SIZE bytes)"
echo

echo "1. minting a signed upload URL…"
MINT=$(curl -s -X POST "$BASE/api/leads/upload-url" \
  -H 'Content-Type: application/json' \
  -d "{\"site\":\"$SITE\",\"clientRef\":\"$REF\",\"fileName\":\"contract.pdf\",\"contentType\":\"application/pdf\",\"size\":$SIZE}")

echo "   $MINT"

UPLOAD_URL=$(printf '%s' "$MINT" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("uploadUrl",""))' 2>/dev/null)
DOC_PATH=$(printf '%s' "$MINT" | python3 -c 'import sys,json; print((json.load(sys.stdin).get("document") or {}).get("path",""))' 2>/dev/null)

if [[ -z "$UPLOAD_URL" ]]; then
  echo
  echo "✗ no uploadUrl returned. What the error means:"
  echo "   storage 404  → the bucket doesn't exist."
  echo "                  Run supabase/0002_lead_documents.sql in the Supabase SQL editor."
  echo "   storage 400/401/403 → bad SUPABASE_SERVICE_ROLE_KEY or wrong SUPABASE_URL."
  echo "   503 'not available' → SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY unset on this deployment."
  echo "   404 (HTML)   → /api/leads/upload-url isn't deployed yet."
  exit 1
fi

echo
echo "2. uploading $SIZE bytes directly to Supabase…"
CODE=$(curl -s -o /tmp/leaddoc-put.out -w '%{http_code}' -X PUT "$UPLOAD_URL" \
  -H 'Content-Type: application/pdf' \
  -H 'cache-control: max-age=3600' \
  -H 'x-upsert: false' \
  --data-binary "@$FILE")

echo "   HTTP $CODE"
echo "   $(cat /tmp/leaddoc-put.out)"
rm -f /tmp/leaddoc-put.out

echo
if [[ "$CODE" == "200" ]]; then
  echo "✓ upload succeeded — $SIZE bytes stored, never touched Vercel."
  echo "  object: $DOC_PATH"
  echo "  Confirm in Supabase → Storage → lead-documents."
else
  echo "✗ upload failed with HTTP $CODE."
  echo "  413 → the file exceeds the bucket's file_size_limit (20MB)."
  echo "  400 → Content-Type not in the bucket's allowed_mime_types."
  echo "  403 → the token expired (they last 2 hours) or the path was already taken."
  exit 1
fi
