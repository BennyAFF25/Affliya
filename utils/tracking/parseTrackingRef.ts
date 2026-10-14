import { isUuid } from "./campaignIdentity";
/** Accept opaque runtime links and previously issued refs without splitting hyphenated emails. */
export function parseTrackingRef(ref: string): string[] {
  if (isUuid(ref)) return [ref, ""];
  if (ref.includes("___")) return ref.split("___");
  if (isUuid(ref.slice(0, 36)) && ref[36] === "-") return [ref.slice(0, 36), ref.slice(37)];
  const legacy = ref.match(/^(\d+)-(.*)$/);
  return legacy ? [legacy[1], legacy[2]] : [ref];
}
