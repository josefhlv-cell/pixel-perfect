import { cs } from "./cs";

type Dict = typeof cs;
const dictionaries: Record<string, Dict> = { cs };
let locale = "cs";

export function setLocale(l: string) {
  if (dictionaries[l]) locale = l;
}

/** Lookup a dotted key, e.g. t("nav.dashboard"). Falls back to the key. */
export function t(key: string): string {
  const parts = key.split(".");
  let cur: unknown = dictionaries[locale];
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) cur = (cur as Record<string, unknown>)[p];
    else return key;
  }
  return typeof cur === "string" ? cur : key;
}
