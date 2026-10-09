export type FutureRadarEvent = {
  type:
    | "NEW_EVIDENCE"
    | "EVIDENCE_REVISION"
    | "REGIME_SHIFT"
    | "MODEL_FLIP"
    | "DECISION_FLIP"
    | "UNCERTAINTY_SPIKE"
    | "DATA_RECOVERY";
  severity: "INFO" | "WARNING" | "CRITICAL";
  key: string;
  before: number | string | null;
  after: number | string | null;
  delta: number | null;
  explanation: string;
};

export function detectFutureRadarEvents(
  previous: Record<string, number | string | null>,
  current: Record<string, number | string | null>,
): FutureRadarEvent[] {
  const events: FutureRadarEvent[] = [];
  const keys = new Set([...Object.keys(previous), ...Object.keys(current)]);
  for (const key of keys) {
    const before = previous[key] ?? null;
    const after = current[key] ?? null;
    if (before === after) continue;

    if (typeof before === "number" && typeof after === "number") {
      const delta = after - before;
      const relative = Math.abs(before) > 1e-9 ? Math.abs(delta / before) : Math.abs(delta);
      if (key.toLowerCase().includes("uncertainty") && relative >= 0.25) {
        events.push({
          type: "UNCERTAINTY_SPIKE",
          severity: relative >= 0.5 ? "CRITICAL" : "WARNING",
          key, before, after, delta,
          explanation: "Nejistota Future Radar se významně změnila.",
        });
      } else if (key.toLowerCase().includes("regime") && Math.abs(delta) >= 0.25) {
        events.push({
          type: "REGIME_SHIFT",
          severity: "CRITICAL",
          key, before, after, delta,
          explanation: "Detekována významná změna režimového skóre.",
        });
      } else if (key.toLowerCase().includes("decision") && Math.abs(delta) >= 1) {
        events.push({
          type: "DECISION_FLIP",
          severity: "CRITICAL",
          key, before, after, delta,
          explanation: "Investiční rozhodnutí se změnilo.",
        });
      } else {
        events.push({
          type: "NEW_EVIDENCE",
          severity: relative >= 0.25 ? "WARNING" : "INFO",
          key, before, after, delta,
          explanation: "Do World State přibyla nebo se změnila informace.",
        });
      }
    } else {
      events.push({
        type: "MODEL_FLIP",
        severity: "WARNING",
        key, before, after, delta: null,
        explanation: "Kategorický stav nebo modelový výstup se změnil.",
      });
    }
  }
  return events.sort((a,b) => {
    const rank = { CRITICAL: 3, WARNING: 2, INFO: 1 };
    return rank[b.severity] - rank[a.severity];
  });
}
