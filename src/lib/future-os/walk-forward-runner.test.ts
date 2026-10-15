import { describe, expect, it } from "vitest";
import { DEFAULT_EXPERIMENT_CONFIG } from "./experiment-config";
import { InMemoryPredictionJournal } from "./prediction-journal";
import { runWalkForward } from "./walk-forward-runner";
import { buildDeterministicWalkForwardFixture } from "./walk-forward-fixture";

describe("walk-forward runner", () => {
  it("commits every prediction before revealing its realization", async () => {
    const journal = new InMemoryPredictionJournal();
    const fixture = buildDeterministicWalkForwardFixture(10, 20);
    let predictionCountAtFirstReveal = -1;

    const result = await runWalkForward({
      config: DEFAULT_EXPERIMENT_CONFIG,
      codeSha: "fixture-code",
      dependencyLockHash: "fixture-lock",
      vintageSnapshotHash: "fixture-vintage",
      seed: 42,
      journal,
      buildCases: () => fixture.cases,
      loadRealization: async (item) => {
        predictionCountAtFirstReveal =
          predictionCountAtFirstReveal === -1
            ? journal.predictions.length
            : predictionCountAtFirstReveal;
        return fixture.loadRealization(item);
      },
    });

    expect(result.cases).toBe(200);
    expect(result.committedPredictions).toBe(200);
    expect(result.revealedRealizations).toBe(200);
    expect(predictionCountAtFirstReveal).toBe(1);
    expect(journal.predictions).toHaveLength(200);
    expect(journal.realizations).toHaveLength(200);
  });

  it("rejects a runner/config graph hash mismatch before prediction", async () => {
    const journal = new InMemoryPredictionJournal();
    const fixture = buildDeterministicWalkForwardFixture(1, 1);
    await expect(
      runWalkForward({
        config: {
          ...DEFAULT_EXPERIMENT_CONFIG,
          trajectoryGraphHash: "0".repeat(64),
        },
        codeSha: "fixture-code",
        dependencyLockHash: "fixture-lock",
        vintageSnapshotHash: "fixture-vintage",
        seed: 42,
        journal,
        buildCases: () => fixture.cases,
        loadRealization: fixture.loadRealization,
      }),
    ).rejects.toThrow(/Trajectory graph hash mismatch/);
    expect(journal.predictions).toHaveLength(0);
  });

  it("runs with zero cases without inventing a result", async () => {
    const journal = new InMemoryPredictionJournal();
    const fixture = buildDeterministicWalkForwardFixture(0, 0);
    const result = await runWalkForward({
      config: DEFAULT_EXPERIMENT_CONFIG,
      codeSha: "fixture-code",
      dependencyLockHash: "fixture-lock",
      vintageSnapshotHash: "fixture-vintage",
      seed: 42,
      journal,
      buildCases: () => fixture.cases,
      loadRealization: fixture.loadRealization,
    });

    expect(result.cases).toBe(0);
    expect(journal.predictions).toHaveLength(0);
    expect(journal.realizations).toHaveLength(0);
  });
});
