import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchEcbCzechLongTermRates } from "./ecb.server";

describe("ECB Czech long-term interest-rate adapter", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("maps monthly CSV observations with explicit units and retrieval provenance", async () => {
    const csv = [
      "KEY,FREQ,REF_AREA,IR_TYPE,TRANS_CAT,MATURITY,BS_COUNT_SECTOR,CURRENCY,IR_BUS_COVERAGE,IR_TYPE_FIX,TIME_PERIOD,OBS_VALUE",
      "IRS.M.CZ.L.L40.CI.0000.CZK.N.Z,M,CZ,L,L40,CI,0000,CZK,N,Z,2024-01,4.02",
      "IRS.M.CZ.L.L40.CI.0000.CZK.N.Z,M,CZ,L,L40,CI,0000,CZK,N,Z,2024-02,4.11",
      "IRS.M.CZ.L.L40.CI.0000.CZK.N.Z,M,CZ,L,L40,CI,0000,CZK,N,Z,2024-03,not-a-number",
    ].join("\n");
    const fetchMock = vi.fn().mockResolvedValue(new Response(csv, {
      status: 200,
      headers: { "content-type": "text/csv" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const observations = await fetchEcbCzechLongTermRates();

    expect(observations).toHaveLength(2);
    expect(observations[0]).toMatchObject({
      sourceId: "ecb-irs-cz-10y",
      geographyKey: "CZ",
      observedAt: "2024-01-01T00:00:00.000Z",
      unit: "percent_per_annum",
      frequency: "monthly",
      value: { value: 4.02, period: "2024-01", measure: "10-year government bond yield" },
      metadata: { quality: "RETRIEVAL_SNAPSHOT" },
    });
    expect(observations[0].retrievedAt).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("fails closed when the provider returns an unexpected CSV schema", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("DATE,RATE\n2024-01,4.2", { status: 200 })));
    await expect(fetchEcbCzechLongTermRates()).rejects.toThrow("missing TIME_PERIOD or OBS_VALUE");
  });
});
