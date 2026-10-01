import type { Claim, ClaimKind, PropertyAnalysis } from "./AIProvider";

export function parseJsonLoose(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const v = JSON.parse(text.slice(start, end + 1));
    return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const KINDS: ClaimKind[] = ["FACT", "ESTIMATE", "ASSUMPTION", "UNKNOWN"];
const claims = (v: unknown): Claim[] =>
  Array.isArray(v)
    ? v
        .map((c) => {
          if (typeof c === "string") return { text: c, kind: "UNKNOWN" as ClaimKind };
          const o = c as { text?: unknown; kind?: unknown };
          if (typeof o?.text !== "string") return null;
          const k = String(o.kind ?? "").toUpperCase() as ClaimKind;
          return { text: o.text, kind: KINDS.includes(k) ? k : "UNKNOWN" };
        })
        .filter((c): c is Claim => !!c)
        .slice(0, 8)
    : [];
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((s): s is string => typeof s === "string").slice(0, 8) : []);

export function parseAnalysis(text: string): PropertyAnalysis {
  const j = parseJsonLoose(text);
  if (!j) {
    return { summary: text.trim().slice(0, 1200), advantages: [], risks: [], missingInfo: [], sellerQuestions: [], dueDiligence: [], scenarios: [], redFlags: [] };
  }
  return {
    summary: typeof j["summary"] === "string" ? j["summary"] : "",
    advantages: claims(j["advantages"]),
    risks: claims(j["risks"]),
    missingInfo: strings(j["missingInfo"]),
    sellerQuestions: strings(j["sellerQuestions"]),
    dueDiligence: strings(j["dueDiligence"]),
    scenarios: claims(j["scenarios"]),
    redFlags: claims(j["redFlags"]),
  };
}
