import { describe, expect, it } from "vitest";
import { parseAradCsv } from "./cnb-arad.server";

describe("parseAradCsv", () => {
  it("parses semicolon-separated Czech values and preserves raw fields", () => {
    const rows = parseAradCsv("Ukazatel;Období;Hodnota;Jednotka\nÚroková sazba;2025-01;5,25;%\n");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      indicator: "Úroková sazba",
      period: "2025-01",
      value: "5,25",
      fields: { Jednotka: "%" },
    });
  });

  it("supports quoted delimiters and escaped quotes", () => {
    const rows = parseAradCsv('Indicator;Period;Value;Note\n"Series; A";2025;12,5;"Said ""yes"""\n');
    expect(rows[0]?.indicator).toBe("Series; A");
    expect(rows[0]?.value).toBe("12,5");
    expect(rows[0]?.fields.Note).toBe('Said "yes"');
  });

  it("returns an empty list for empty exports and header-only responses", () => {
    expect(parseAradCsv("")).toEqual([]);
    expect(parseAradCsv("Indicator;Period;Value\n")).toEqual([]);
  });
});
