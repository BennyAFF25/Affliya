#!/bin/bash

set -e

if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
  echo "SUPABASE_ACCESS_TOKEN: missing"
  exit 1
fi

if [ -z "$SUPABASE_PROJECT_REF" ]; then
  echo "SUPABASE_PROJECT_REF: missing"
  exit 1
fi

echo "== Supabase: Recent Logs (Postgres Errors) =="

curl -s \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/logs?service=postgres" \
  | jq '.[] | select(.level=="error") | {timestamp, message}'

echo ""
echo "== Supabase: Edge Function Errors =="

curl -s \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/logs?service=edge-functions" \
  | jq '.[] | select(.level=="error") | {timestamp, message}'

echo ""
echo "== Supabase: Auth Errors =="

curl -s \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/logs?service=auth" \
  | jq '.[] | select(.level=="error") | {timestamp, message}'
