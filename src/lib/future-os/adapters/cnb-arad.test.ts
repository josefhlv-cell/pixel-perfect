import { describe, expect, it } from "vitest";
import { decodeBody, parseData, parseDelimited, parseIndicators, parseNumber, parsePeriod } from "./cnb-arad";

describe("ČNB ARAD parsing", () => {
  it("handles BOM, CRLF, quotes and escaped quotes", () => {
    const t = parseDelimited('\uFEFFa;b\r\n"x;1";"he said ""hi"""\r\n');
    expect(t).toEqual([["a", "b"], ["x;1", 'he said "hi"']]);
  });
  it("parses decimal comma and rejects garbage", () => {
    expect(parseNumber("7400185680,8")).toBe(7400185680.8);
    expect(parseNumber("1 234,5")).toBe(1234.5);
    expect(parseNumber("-0.25")).toBe(-0.25);
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("n/a")).toBeNull();
  });
  it("parses only unambiguous periods", () => {
    expect(parsePeriod("20251231")?.iso).toBe("2025-12-31T00:00:00.000Z");
    expect(parsePeriod("2025-06")?.granularity).toBe("month");
    expect(parsePeriod("20251331")).toBeNull();
    expect(parsePeriod("Q3 2025")).toBeNull();
  });
  it("decodes windows-1250 Czech text", () => {
    const bytes = new Uint8Array([0x8a, 0xe8, 0xf8, 0x9e]); // Š č ř ž
    expect(decodeBody(bytes, "text/csv; charset=EE8MSWIN1250")).toBe("Ščřž");
  });
  it("parses the real data/indicator shape and keeps original fields", () => {
    const data = 'indicator_id;snapshot_id;period;value\n"SFTP02M11";;"20250131";3,75\n"SFTP02M11";;"20250228";\n';
    const { rows, skipped } = parseData(data);
    expect(rows).toHaveLength(1);
    expect(skipped).toBe(1);
    expect(rows[0]!.value).toBe(3.75);
    expect(rows[0]!.original["period"]).toBe("20250131");
    const meta = parseIndicators('indicator_id;indicator_name;frequency_code;frequency_name;unit_mult_code;unit_mult_name;unit\n"SFTP02M11";"Diskontní sazba";"M";"Měsíční";"0";"jednotky";"procento"\n');
    expect(meta.get("SFTP02M11")?.unit).toBe("procento");
    expect(meta.get("SFTP02M11")?.frequencyCode).toBe("M");
  });
  it("yields no rows when nothing numeric is present (import then refuses to store)", () => {
    expect(parseData("indicator_id;period;value\nX;2025;abc\n").rows).toHaveLength(0);
  });
});
