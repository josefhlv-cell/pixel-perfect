import { describe, expect, it } from "vitest";
import {
  PRIMARY_H2_VINTAGE_AUDIT,
  validateVintageAudit,
} from "./audit";
import { hashVintageSnapshot } from "./snapshot";
import { asOf } from "./as-of";
import type { VintageObservation } from "./types";

const known: VintageObservation = {
  region: "CZ",
  series: "x",
  obsDate: "2020-01-01T00:00:00.000Z",
  vintageDate: "2020-02-01T00:00:00.000Z",
  value: 1,
  quality: "OBSERVED_VINTAGE",
};

describe("vintage integrity", () => {
  it("keeps the four-node audit explicitly blocked until source verification", () => {
    expect(PRIMARY_H2_VINTAGE_AUDIT).toHaveLength(4);
    expect(() => validateVintageAudit(PRIMARY_H2_VINTAGE_AUDIT, true)).toThrow(
      /Strict vintage audit is not complete/,
    );
    expect(() => validateVintageAudit(PRIMARY_H2_VINTAGE_AUDIT, false)).not.toThrow();
  });

  it("passes legitimate as-of data and excludes inserted future data", () => {
    const future = { ...known, vintageDate: "2022-01-01T00:00:00.000Z" };
    expect(asOf([known, future], { asOf: "2021-01-01T00:00:00.000Z" })).toEqual([known]);
  });

  it("produces an order-independent snapshot hash", async () => {
    const other = { ...known, series: "y" };
    const first = await hashVintageSnapshot([known, other]);
    const second = await hashVintageSnapshot([other, known]);
    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
  });
});
