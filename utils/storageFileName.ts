export function safeStorageFileName(name: string) {
  const normalized = name
    .normalize("NFKD")
    .replace(/[^\u0020-\u007E]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  return normalized || "image";
}

