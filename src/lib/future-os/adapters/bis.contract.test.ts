import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("BIS adapter contract", () => {
  it("uses the documented WS_SPP dataflow and SDMX JSON negotiation", () => {
    const source = readFileSync(new URL("./bis.server.ts", import.meta.url), "utf8");
    expect(source).toContain("WS_SPP");
    expect(source).toContain("application/vnd.sdmx.data+json");
    expect(source).toContain('const key = "Q."');
    expect(source).toContain('"." + measures.join("+")');
  });
});
