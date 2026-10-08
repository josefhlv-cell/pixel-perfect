import type { EvidenceObservation } from "./types";

export type SourceSyncResult = {
  adapterKey: string;
  startedAt: string;
  finishedAt: string;
  fetched: number;
  inserted: number;
  unchanged: number;
  revised: number;
  error?: string;
};

export type SyncAdapter = (signal?: AbortSignal) => Promise<EvidenceObservation[]>;

export async function runSourceSync(
  adapterKey: string,
  adapter: SyncAdapter,
  ingest: (adapterKey: string, rows: EvidenceObservation[]) => Promise<{ inserted: number; unchanged: number; revised: number }>,
  signal?: AbortSignal,
): Promise<SourceSyncResult> {
  const startedAt = new Date().toISOString();
  try {
    const rows = await adapter(signal);
    const result = await ingest(adapterKey, rows);
    return {
      adapterKey,
      startedAt,
      finishedAt: new Date().toISOString(),
      fetched: rows.length,
      ...result,
    };
  } catch (error) {
    return {
      adapterKey,
      startedAt,
      finishedAt: new Date().toISOString(),
      fetched: 0,
      inserted: 0,
      unchanged: 0,
      revised: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
