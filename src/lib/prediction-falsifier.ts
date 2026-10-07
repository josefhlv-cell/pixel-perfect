/**
 * Reality Investor — forecast falsification engine.
 *
 * A good prediction is allowed to die. This layer searches for evidence
 * that would invalidate the current thesis before the market invalidates it.
 */

export interface FalsificationRule{
  name:string;
  metric:string;
  operator:"LT"|"LTE"|"GT"|"GTE"|"ABS_GT";
  threshold:number;
  severity:"HIGH"|"MEDIUM"|"LOW";
  explanation:string;
}

export interface FalsificationResult{
  invalidated:boolean;
  triggered:FalsificationRule[];
  score:number;
  message:string;
}

function hit(value:number,rule:FalsificationRule){
  if(rule.operator==="LT")return value<rule.threshold;
  if(rule.operator==="LTE")return value<=rule.threshold;
  if(rule.operator==="GT")return value>rule.threshold;
  if(rule.operator==="GTE")return value>=rule.threshold;
  return Math.abs(value)>rule.threshold;
}

export function falsifyForecast(
  metrics:Record<string,number>,
  rules:FalsificationRule[],
):FalsificationResult{
  const triggered=rules.filter(r=>metrics[r.metric]!=null&&hit(metrics[r.metric]!,r));
  const weighted=triggered.reduce((s,r)=>s+(r.severity==="HIGH"?3:r.severity==="MEDIUM"?2:1),0);
  return {
    invalidated:triggered.some(r=>r.severity==="HIGH"),
    triggered,
    score:weighted,
    message:triggered.length
      ? `Teze má ${triggered.length} porušení; systém ji musí přehodnotit.`
      : "Žádné předem definované podmínky invalidace nebyly spuštěny."
  };
}

export function defaultMarketFalsifiers(expectedGrowthBps:number):FalsificationRule[]{
  return [
    {name:"trend_break",metric:"realizedGrowthBps",operator:"LT",threshold:expectedGrowthBps-2500,severity:"HIGH",explanation:"realizovaný růst výrazně zaostává za forecastem"},
    {name:"rate_shock",metric:"mortgageRateChangeBps",operator:"GT",threshold:100,severity:"HIGH",explanation:"financování se zhoršilo rychleji než předpoklad"},
    {name:"inventory_shock",metric:"inventoryChangeBps",operator:"GT",threshold:1800,severity:"MEDIUM",explanation:"nabídka roste rychleji než model čekal"},
    {name:"liquidity_break",metric:"domChangeBps",operator:"GT",threshold:2500,severity:"MEDIUM",explanation:"doba prodeje se prudce prodlužuje"},
  ];
}
