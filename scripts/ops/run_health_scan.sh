#!/bin/bash

if [ -z "$NETTMARK_DB_READONLY_URL" ]; then
  echo "Missing NETTMARK_DB_READONLY_URL"
  exit 1
fi

psql "$NETTMARK_DB_READONLY_URL" -f scripts/ops/health_scan.sql
