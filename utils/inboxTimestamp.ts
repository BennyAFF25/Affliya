/** Postgres timestamp without a zone is UTC in legacy inbox records. */
export function parseInboxTimestamp(value: string): Date {
  const text = value.trim();
  const naive = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(text);
  return new Date(naive ? text.replace(' ', 'T') + 'Z' : text);
}
export function formatInboxTimestamp(value?: string | null, options?: Intl.DateTimeFormatOptions) {
  if (!value) return 'Unknown date';
  const date = parseInboxTimestamp(value);
  return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleString('en-AU', options);
}
