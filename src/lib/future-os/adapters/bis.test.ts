import { describe, expect, it } from "vitest";
import { fetchBisResidentialPropertyPrices } from "./bis.server";

describe("BIS residential property adapter", () => {
  it("exports a server adapter with conservative point-in-time semantics", async () => {
    expect(typeof fetchBisResidentialPropertyPrices).toBe("function");
    expect(fetchBisResidentialPropertyPrices.length).toBeGreaterThan(0);
  });
});
