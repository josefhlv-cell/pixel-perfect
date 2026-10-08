import type { VintageObservation } from "./types";

function canonicalObservation(row: VintageObservation): string {
  return JSON.stringify({
    region: row.region,
    series: row.series,
    obsDate: row.obsDate,
    vintageDate: row.vintageDate,
    value: row.value,
    quality: row.quality,
    sourceId: row.sourceId ?? null,
    revision: row.revision ?? null,
  });
}

export function canonicalizeVintageSnapshot(
  observations: readonly VintageObservation[],
): string {
  return [...observations]
    .sort((a, b) =>
      [
        a.region,
        a.series,
        a.obsDate,
        a.vintageDate,
        String(a.revision ?? ""),
      ]
        .join("|")
        .localeCompare(
          [
            b.region,
            b.series,
            b.obsDate,
            b.vintageDate,
            String(b.revision ?? ""),
          ].join("|"),
        ),
    )
    .map(canonicalObservation)
    .join("\n");
}

export async function hashVintageSnapshot(
  observations: readonly VintageObservation[],
): Promise<string> {
  const bytes = new TextEncoder().encode(
    canonicalizeVintageSnapshot(observations),
  );
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
