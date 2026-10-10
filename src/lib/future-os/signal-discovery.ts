import type { EvidenceObservation } from "./types";

export type SignalPoint = {
  date: string;
  value: number;
  evidenceId?: string;
};

export type LeadTestInput = {
  signal: SignalPoint[];
  target: SignalPoint[];
  lagDays: number;
  windowDays: number;
  minSamples?: number;
};

export type LeadTestResult = {
  sampleCount: number;
  correlation: number | null;
  rankCorrelation: number | null;
  directionalAccuracy: number | null;
  mutualInformation: number | null;
  stability: number | null;
  falseAlarmRate: number | null;
  leadScore: number | null;
  status: "CANDIDATE" | "VALIDATED" | "REJECTED";
};

const DAY = 86_400_000;

function pearson(a: number[], b: number[]): number | null {
  if (a.length < 3 || a.length !== b.length) return null;
  const ma = a.reduce((s, x) => s + x, 0) / a.length;
  const mb = b.reduce((s, x) => s + x, 0) / b.length;
  const da = a.map((x) => x - ma);
  const db = b.map((x) => x - mb);
  const den = Math.sqrt(da.reduce((s, x) => s + x * x, 0) * db.reduce((s, x) => s + x * x, 0));
  return den === 0 ? 0 : da.reduce((s, x, i) => s + x * db[i]!, 0) / den;
}

function ranks(values: number[]): number[] {
  const indexed = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
  const result = Array(values.length);
  let i = 0;
  while (i < indexed.length) {
    let j = i + 1;
    while (j < indexed.length && indexed[j]!.value === indexed[i]!.value) j++;
    const rank = (i + j - 1) / 2;
    for (; i < j; i++) result[indexed[i]!.index] = rank;
  }
  return result;
}

function quantileBins(values: number[], bins = 4): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  return values.map((value) => {
    let rank = sorted.findIndex((x) => x >= value);
    if (rank < 0) rank = sorted.length - 1;
    return Math.min(bins - 1, Math.floor((rank / Math.max(1, sorted.length - 1)) * bins));
  });
}

function mutualInformation(a: number[], b: number[]): number | null {
  if (a.length < 8 || a.length !== b.length) return null;
  const ax = quantileBins(a);
  const bx = quantileBins(b);
  const n = a.length;
  const joint = new Map<string, number>();
  const pa = new Map<number, number>();
  const pb = new Map<number, number>();
  for (let i = 0; i < n; i++) {
    joint.set(`${ax[i]}|${bx[i]}`, (joint.get(`${ax[i]}|${bx[i]}`) ?? 0) + 1);
    pa.set(ax[i]!, (pa.get(ax[i]!) ?? 0) + 1);
    pb.set(bx[i]!, (pb.get(bx[i]!) ?? 0) + 1);
  }
  let mi = 0;
  for (const [key, count] of joint) {
    const [ia, ib] = key.split("|").map(Number);
    const pxy = count / n;
    mi += pxy * Math.log(pxy / ((pa.get(ia!)! / n) * (pb.get(ib!)! / n)));
  }
  return Math.max(0, mi);
}

function pairByLag(signal: SignalPoint[], target: SignalPoint[], lagDays: number) {
  const sortedSignal = [...signal].sort((a, b) => +new Date(a.date) - +new Date(b.date));
  const sortedTarget = [...target].sort((a, b) => +new Date(a.date) - +new Date(b.date));
  const s = [], t = [];
  for (const point of sortedSignal) {
    const desired = +new Date(point.date) + lagDays * DAY;
    let best: SignalPoint | undefined;
    let bestDistance = Infinity;
    for (const candidate of sortedTarget) {
      const distance = Math.abs(+new Date(candidate.date) - desired);
      if (distance < bestDistance) { best = candidate; bestDistance = distance; }
    }
    if (best && bestDistance <= Math.max(7 * DAY, lagDays * DAY * 0.15)) {
      s.push(point.value);
      t.push(best.value);
    }
  }
  return { s, t };
}

function directionalAccuracy(a: number[], b: number[]): number | null {
  if (a.length < 4) return null;
  let hits = 0, count = 0;
  for (let i = 1; i < a.length; i++) {
    const da = Math.sign(a[i]! - a[i - 1]!);
    const db = Math.sign(b[i]! - b[i - 1]!);
    if (da === 0 || db === 0) continue;
    count++;
    if (da === db) hits++;
  }
  return count ? hits / count : null;
}

function stabilityByHalf(a: number[], b: number[]): number | null {
  if (a.length < 10) return null;
  const mid = Math.floor(a.length / 2);
  const left = pearson(a.slice(0, mid), b.slice(0, mid));
  const right = pearson(a.slice(mid), b.slice(mid));
  if (left == null || right == null) return null;
  return Math.max(0, 1 - Math.abs(left - right) / 2);
}

export function evaluateLeadingSignal(input: LeadTestInput): LeadTestResult {
  const minSamples = input.minSamples ?? 10;
  const { s, t } = pairByLag(input.signal, input.target, input.lagDays);
  if (s.length < minSamples) {
    return { sampleCount: s.length, correlation: null, rankCorrelation: null, directionalAccuracy: null, mutualInformation: null, stability: null, falseAlarmRate: null, leadScore: null, status: "REJECTED" };
  }
  const correlation = pearson(s, t);
  const rankCorrelation = pearson(ranks(s), ranks(t));
  const direction = directionalAccuracy(s, t);
  const mi = mutualInformation(s, t);
  const stability = stabilityByHalf(s, t);
  const strong = s.map((x, i) => Math.abs(x) > 0 && Math.abs(t[i]!) > 0 && Math.sign(x) === Math.sign(t[i]!));
  const falseAlarmRate = strong.length ? 1 - strong.filter(Boolean).length / strong.length : null;
  const absCorr = Math.abs(correlation ?? 0);
  const absRank = Math.abs(rankCorrelation ?? 0);
  const leadScore = Math.max(0, Math.min(1,
    absCorr * 0.30 +
    absRank * 0.20 +
    (direction ?? 0.5) * 0.15 +
    Math.min(1, (mi ?? 0) / 0.5) * 0.10 +
    (stability ?? 0) * 0.20 -
    (falseAlarmRate ?? 0.5) * 0.15,
  ));
  const status = leadScore >= 0.68 && (stability ?? 0) >= 0.55 && absCorr >= 0.35 ? "VALIDATED"
    : leadScore >= 0.45 ? "CANDIDATE"
    : "REJECTED";
  return { sampleCount: s.length, correlation, rankCorrelation, directionalAccuracy: direction, mutualInformation: mi, stability, falseAlarmRate, leadScore, status };
}

export function discoverLeadingSignals(
  observations: EvidenceObservation[],
  targetEntityKey: string,
  lagDaysList = [30, 90, 180, 365],
) {
  const byEntity = new Map<string, SignalPoint[]>();
  for (const row of observations) {
    if (typeof row.value !== "number") continue;
    const key = `${row.entityType}:${row.entityKey}`;
    const list = byEntity.get(key) ?? [];
    list.push({ date: row.effectiveFrom ?? row.observedAt, value: row.value, evidenceId: row.id });
    byEntity.set(key, list);
  }
  const target = byEntity.get(targetEntityKey) ?? [];
  if (!target.length) return [];
  const results: Array<LeadTestResult & { signalKey: string; lagDays: number }> = [];
  for (const [signalKey, signal] of byEntity) {
    if (signalKey === targetEntityKey) continue;
    for (const lagDays of lagDaysList) {
      const result = evaluateLeadingSignal({ signal, target, lagDays, windowDays: lagDays });
      results.push({ ...result, signalKey, lagDays });
    }
  }
  return results
    .filter((result) => result.leadScore != null)
    .sort((a, b) => (b.leadScore ?? 0) - (a.leadScore ?? 0));
}
