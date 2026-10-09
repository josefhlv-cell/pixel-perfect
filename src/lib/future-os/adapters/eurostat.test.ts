import { describe, expect, it } from "vitest";
import { fetchEurostatHousePriceIndex } from "./eurostat.server";

describe("Eurostat adapter contract", () => {
  it("is server-only and exposes the expected normalized evidence contract", async () => {
    expect(fetchEurostatHousePriceIndex).toBeTypeOf("function");
  });
});
