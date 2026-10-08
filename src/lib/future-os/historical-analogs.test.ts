import { describe, expect, it } from "vitest";
import { findHistoricalAnalogs } from "./historical-analogs";

describe("Historical analogs",()=>{
  it("ranks the closest historical state first",()=>{
    const result=findHistoricalAnalogs(
      {rates:4,liquidity:80},
      [
        {date:"2019",features:{rates:4.1,liquidity:82}},
        {date:"2020",features:{rates:1,liquidity:120}},
      ],
    );
    expect(result[0].date).toBe("2019");
    expect(result[0].similarity).toBeGreaterThan(result[1].similarity);
  });
});
