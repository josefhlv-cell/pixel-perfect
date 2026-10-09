import { createHash } from "node:crypto";
import type { EvidenceObservation } from "./types";

function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stable(object[key])}`).join(",")}}`;
}

export function evidenceContentHash(input: Pick<EvidenceObservation,
  "sourceId" | "geographyType" | "geographyKey" | "entityType" | "entityKey" | "revision" | "value"
>): string {
  const canonical = stable({
    sourceId: input.sourceId,
    geographyType: input.geographyType,
    geographyKey: input.geographyKey,
    entityType: input.entityType,
    entityKey: input.entityKey,
    revision: input.revision,
    value: input.value,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

export function evidenceIdentity(input: Pick<EvidenceObservation,
  "sourceId" | "geographyType" | "geographyKey" | "entityType" | "entityKey" | "revision"
>): string {
  return [
    input.sourceId,
    input.geographyType,
    input.geographyKey,
    input.entityType,
    input.entityKey,
    input.revision,
  ].join("|");
}
