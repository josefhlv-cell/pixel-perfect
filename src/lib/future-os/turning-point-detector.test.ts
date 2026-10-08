import { describe, expect, it } from "vitest";
import { detectTurningPoint, fuseTurningPointSignals } from "./turning-point-detector";

function points(values: number[]) {
  return values.map((value, i) => ({
    date: new Date(Date.UTC(2020, i, 1)).toISOString(),
    value,
  }));
}

describe("Future OS turning point detector", () => {
  it("stays quiet on a stable trend", () => {
    const result = detectTurningPoint({ key: "stable", points: points(Array.from({ length: 24 }, (_, i) => i)) });
    expect(result.status).toBe("QUIET");
  });

  it("detects a persistent acceleration change", () => {
    const values = Array.from({ length: 24 }, (_, i) => i < 16 ? i : 16 + (i - 15) * 4);
    const result = detectTurningPoint({ key: "break", points: points(values) });
    expect(["EARLY_WARNING", "BREAK"]).toContain(result.status);
    expect(result.direction).toBe(1);
    expect(result.persistence).toBeGreaterThan(0.6);
  });

  it("requires cross-signal agreement for a strong market warning", () => {
    const values = Array.from({ length: 24 }, (_, i) => i < 16 ? i : 16 + (i - 15) * 4);
    const result = fuseTurningPointSignals([
      { key: "a", points: points(values), weight: 1 },
      { key: "b", points: points(values), weight: 1 },
      { key: "noise", points: points(Array.from({ length: 24 }, (_, i) => i + (i % 2 ? 1 : -1))), weight: 0.2 },
    ]);
    expect(result.direction).toBe(1);
    expect(result.agreement).toBeGreaterThan(0.6);
  });
});
