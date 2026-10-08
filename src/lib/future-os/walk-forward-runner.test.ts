import { describe, expect, it } from "vitest";
import { DEFAULT_EXPERIMENT_CONFIG } from "./experiment-config";
import { InMemoryPredictionJournal } from "./prediction-journal";
import { runWalkForward } from "./walk-forward-runner";
import { buildDeterministicWalkForwardFixture } from "./walk-forward-fixture";

describe("walk-forward runner", () => {
  it("commits every prediction before revealing its realization", async () => {
    const journal = new InMemoryPredictionJournal();
    const result = await runWalkForward({
      config: DEFAULT_EXPERIMENT_CONFIG,
      codeSha: "fixture-code",
      dependencyLockHash: "fixture-lock",
      vintageSnapshotHash: "fixture-vintage",
      seed: 42,
      journal,
      buildCases: () => buildDeterministicWalkForwardFixture(10, 20),
    });

    expect(result.cases).toBe(200);
    expect(result.committedPredictions).toBe(200);
    expect(result.revealedRealizations).toBe(200);
    expect(journal.predictions).toHaveLength(200);
    expect(journal.realizations).toHaveLength(200);
  });

  it("runs with zero cases without inventing a result", async () => {
    const journal = new InMemoryPredictionJournal();
    const result = await runWalkForward({
      config: DEFAULT_EXPERIMENT_CONFIG,
      codeSha: "fixture-code",
      dependencyLockHash: "fixture-lock",
      vintageSnapshotHash: "fixture-vintage",
      seed: 42,
      journal,
      buildCases: () => [],
    });
    expect(result.cases).toBe(0);
    expect(journal.predictions).toHaveLength(0);
    expect(journal.realizations).toHaveLength(0);
  });
});
