import { describe, expect, it } from "vitest";
import { DEFAULT_EXPERIMENT_CONFIG } from "./experiment-config";
import { assertNoLookAhead, hashExperimentConfig } from "./experiment-integrity";

describe("Experiment integrity", () => {
  it("fails deliberately injected future data", () => {
    expect(() =>
      assertNoLookAhead(
        [{
          region: "CZ",
          series: "house_price",
          obsDate: "2020-01-01T00:00:00.000Z",
          vintageDate: "2021-02-01T00:00:00.000Z",
          value: 100,
          quality: "OBSERVED_VINTAGE",
        }],
        "2021-01-01T00:00:00.000Z",
      ),
    ).toThrow(/Look-ahead leakage detected/);
  });

  it("accepts data known at the cutoff", () => {
    expect(() =>
      assertNoLookAhead(
        [{
          region: "CZ",
          series: "house_price",
          obsDate: "2020-01-01T00:00:00.000Z",
          vintageDate: "2020-02-01T00:00:00.000Z",
          value: 100,
          quality: "OBSERVED_VINTAGE",
        }],
        "2021-01-01T00:00:00.000Z",
      ),
    ).not.toThrow();
  });

  it("produces a deterministic cryptographic config fingerprint", async () => {
    const first = await hashExperimentConfig(DEFAULT_EXPERIMENT_CONFIG);
    const second = await hashExperimentConfig(DEFAULT_EXPERIMENT_CONFIG);
    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changes the fingerprint when a preregistered parameter changes", async () => {
    const first = await hashExperimentConfig(DEFAULT_EXPERIMENT_CONFIG);
    const changed = await hashExperimentConfig({
      ...DEFAULT_EXPERIMENT_CONFIG,
      delta: 0.21,
    });
    expect(changed).not.toBe(first);
  });
});