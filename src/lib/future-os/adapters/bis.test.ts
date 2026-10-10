import { describe, expect, it } from "vitest";
import { fetchBisResidentialPropertyPrices, parseBisResidentialPropertyPrices } from "./bis.server";

describe("BIS residential property adapter", () => {
  it("exports a server adapter with conservative point-in-time semantics", () => {
    expect(typeof fetchBisResidentialPropertyPrices).toBe("function");
  });

  it("parses SDMX series dimensions rather than assuming a fixed series order", () => {
    const fixture = {
      data: {
        structure: {
          dimensions: {
            series: [
              { id: "FREQ", values: [{ id: "Q" }] },
              { id: "REF_AREA", values: [{ id: "CZ" }, { id: "PL" }] },
              { id: "VALUE_MEASURE", values: [{ id: "N" }, { id: "R" }] },
              { id: "UNIT_MEASURE", values: [{ id: "628" }] },
            ],
            observation: [
              { id: "TIME_PERIOD", values: [{ id: "2024-Q1" }, { id: "2024-Q2" }] },
            ],
          },
        },
        dataSets: [{
          series: {
            "0:0:0:0": { observations: { "0": [100], "1": [102] } },
            "0:0:1:0": { observations: { "0": [95], "1": [97] } },
            "0:1:0:0": { observations: { "0": [200], "1": [202] } },
          },
        }],
      },
    };

    expect(parseBisResidentialPropertyPrices(fixture, ["CZ"])).toEqual([
      { geo: "CZ", measure: "N", period: "2024-Q1", value: 100 },
      { geo: "CZ", measure: "N", period: "2024-Q2", value: 102 },
      { geo: "CZ", measure: "R", period: "2024-Q1", value: 95 },
      { geo: "CZ", measure: "R", period: "2024-Q2", value: 97 },
    ]);
  });

  it("drops malformed values and excludes unrequested geographies", () => {
    const fixture = {
      data: {
        structure: {
          dimensions: {
            series: [
              { id: "FREQ", values: [{ id: "Q" }] },
              { id: "REF_AREA", values: [{ id: "CZ" }, { id: "PL" }] },
              { id: "VALUE_MEASURE", values: [{ id: "N" }] },
            ],
            observation: [{ id: "TIME_PERIOD", values: [{ id: "2024-Q1" }, { id: "not-a-period" }] }],
          },
        },
        dataSets: [{
          series: {
            "0:0:0": { observations: { "0": [100], "1": [101], "2": [102], "3": [Number.NaN] } },
            "0:1:0": { observations: { "0": [999] } },
          },
        }],
      },
    };

    expect(parseBisResidentialPropertyPrices(fixture, ["CZ"])).toEqual([
      { geo: "CZ", measure: "N", period: "2024-Q1", value: 100 },
    ]);
  });
});
