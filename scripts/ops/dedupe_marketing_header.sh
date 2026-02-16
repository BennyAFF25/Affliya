#!/usr/bin/env bash
set -euo pipefail

FILES=(
  "app/page.tsx"
  "app/for-businesses/page.tsx"
  "app/for-partners/page.tsx"
  "app/pricing/page.tsx"
)

fixed=0

for f in "${FILES[@]}"; do
  [ -f "$f" ] || continue

  # Count JSX renders, not imports
  c=$(grep -Eo "<MarketingHeader" "$f" | wc -l | tr -d ' ')
  if [ "${c:-0}" -le 1 ]; then
    continue
  fi

  echo "⚠️  $f has $c <MarketingHeader /> renders — deduping…"

  # Keep the first <MarketingHeader ...> line, remove subsequent ones
  awk '
    BEGIN{seen=0}
    /<MarketingHeader/{
      if(seen==0){seen=1; print; next}
      next
    }
    {print}
  ' "$f" > "$f.__tmp__" && mv "$f.__tmp__" "$f"

  fixed=1
done

if [ "$fixed" -eq 1 ]; then
  echo "✅ Deduped MarketingHeader renders."
else
  echo "✅ No duplicates found."
fi
