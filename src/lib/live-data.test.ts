import { describe, expect, it } from "vitest";
import { observedMean, onlyLive } from "./live-data";

describe("production data policy", () => {
  it("excludes sample rows at the query boundary and keeps real rows", () => {
    const rows = [
      { id: "demo", is_sample: true },
      { id: "live", is_sample: false },
    ];
    const result = onlyLive({ eq: (column, value) => rows.filter((row) => row[column] === value) });
    expect(result).toEqual([{ id: "live", is_sample: false }]);
  });
  it("does not replace absent observations with zero", () => {
    expect(observedMean([null, NaN, Infinity])).toBeNull();
    expect(observedMean([300, null, 400])).toBe(350);
  });
});
