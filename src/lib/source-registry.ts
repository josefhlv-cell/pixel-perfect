/**
 * Reality Investor — source registry.
 *
 * Source diversity is intentional: transaction truth, official macro data,
 * listing behavior and alternative leading indicators must not be conflated.
 */

export interface SourceDefinition{
  id:string;
  name:string;
  domain:string;
  truthLevel:"TRANSACTION"|"OBSERVED_MARKET"|"MACRO"|"ALTERNATIVE";
  expectedLatencyDays:number;
  revisionRisk:"LOW"|"MEDIUM"|"HIGH";
  geography:string[];
  signals:string[];
}

export const CZECH_SOURCE_REGISTRY:SourceDefinition[]=[
  {id:"CSU_RE",name:"ČSÚ — Ceny nemovitostí",domain:"csu.gov.cz",truthLevel:"TRANSACTION",expectedLatencyDays:180,revisionRisk:"MEDIUM",geography:["CZ"],signals:["realized_prices","price_indices"]},
  {id:"CUZK",name:"ČÚZK / katastr",domain:"cuzk.gov.cz",truthLevel:"TRANSACTION",expectedLatencyDays:180,revisionRisk:"MEDIUM",geography:["CZ"],signals:["transactions","property_identity","geography"]},
  {id:"CNB_ARAD",name:"ČNB ARAD",domain:"cnb.cz",truthLevel:"MACRO",expectedLatencyDays:30,revisionRisk:"MEDIUM",geography:["CZ"],signals:["policy_rates","mortgage_rates","credit"]},
  {id:"CNB_BLS",name:"ČNB Bank Lending Survey",domain:"cnb.cz",truthLevel:"MACRO",expectedLatencyDays:90,revisionRisk:"LOW",geography:["CZ"],signals:["credit_standards","housing_loan_demand"]},
  {id:"LISTING_PORTALS",name:"Realitní portály",domain:"multiple",truthLevel:"OBSERVED_MARKET",expectedLatencyDays:1,revisionRisk:"HIGH",geography:["CZ"],signals:["asking_price","inventory","dom","price_cuts","withdrawals"]},
  {id:"RUIAN",name:"RÚIAN",domain:"cuzk.gov.cz",truthLevel:"TRANSACTION",expectedLatencyDays:30,revisionRisk:"LOW",geography:["CZ"],signals:["addresses","cadastral_areas","spatial_features"]}
];

export function sourcePriority(source:SourceDefinition){
  const truth=source.truthLevel==="TRANSACTION"?1:source.truthLevel==="OBSERVED_MARKET"?.8:source.truthLevel==="MACRO"?.85:.55;
  const latency=1-Math.min(1,source.expectedLatencyDays/365)*.25;
  const revision=source.revisionRisk==="LOW"?1:source.revisionRisk==="MEDIUM"?.9:.72;
  return truth*latency*revision;
}
