const FILLER = new Set(["the", "a", "an", "and", "of", "for", "to", "in", "on", "with", "&", "by", "at", "or"]);

/** Up to two uppercase initials from significant words; "N" (Nettmark) when empty. */
export function brandInitials(name?: string | null): string {
  const words = String(name ?? "")
    .replace(/[^\p{L}\p{N}\s&'-]/gu, " ")
    .split(/[\s-]+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean);
  const significant = words.filter((w) => !FILLER.has(w.toLowerCase()));
  const pool = significant.length ? significant : words;
  if (!pool.length) return "N";
  return pool.slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}
