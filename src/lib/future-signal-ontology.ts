/**
 * Future Signal Ontology
 *
 * A machine-readable map of leading/confirming/lagging evidence families.
 * It is a routing contract, not a claim that every listed signal leads by a
 * fixed number of days. Actual lead time is learned by future-lead-time-learning.
 */

export type EvidenceRole = "LEADING"|"COINCIDENT"|"LAGGING";
export type EvidenceFamily =
  | "CREDIT"|"MORTGAGE"|"LISTING"|"WITHDRAWAL"|"RENT"
  | "TRANSACTION"|"INCOME"|"EMPLOYMENT"|"CONSTRUCTION"|"PERMITS"
  | "DEMOGRAPHY"|"MIGRATION"|"INFRASTRUCTURE"|"POLICY"
  | "SEARCH_BEHAVIOR"|"SENTIMENT"|"ENERGY"|"MACRO";

export interface SignalOntologyEntry {
  family:EvidenceFamily;
  role:EvidenceRole;
  mechanisms:string[];
  targetStates:string[];
  defaultReliability:number;
  defaultFreshnessDays:number;
  recommendedWeight:number;
}

export const FUTURE_SIGNAL_ONTOLOGY:SignalOntologyEntry[]=[
  {family:"CREDIT",role:"LEADING",mechanisms:["borrowing-capacity","credit-cycle"],targetStates:["ACCELERATION","DECELERATION","LIQUIDITY_CRISIS"],defaultReliability:.88,defaultFreshnessDays:45,recommendedWeight:1},
  {family:"MORTGAGE",role:"LEADING",mechanisms:["monthly-payment","affordability"],targetStates:["ACCELERATION","DECELERATION"],defaultReliability:.9,defaultFreshnessDays:31,recommendedWeight:1},
  {family:"LISTING",role:"LEADING",mechanisms:["inventory","seller-pressure"],targetStates:["ACCELERATION","DECELERATION","CORRECTION"],defaultReliability:.68,defaultFreshnessDays:7,recommendedWeight:.9},
  {family:"WITHDRAWAL",role:"LEADING",mechanisms:["seller-expectation","liquidity"],targetStates:["CORRECTION","LIQUIDITY_CRISIS","RECOVERY"],defaultReliability:.72,defaultFreshnessDays:7,recommendedWeight:.95},
  {family:"SEARCH_BEHAVIOR",role:"LEADING",mechanisms:["intent","demand-funnel"],targetStates:["ACCELERATION","RECOVERY","DECELERATION"],defaultReliability:.55,defaultFreshnessDays:3,recommendedWeight:.7},
  {family:"PERMITS",role:"LEADING",mechanisms:["future-supply"],targetStates:["DECELERATION","CORRECTION","ACCELERATION"],defaultReliability:.8,defaultFreshnessDays:90,recommendedWeight:.85},
  {family:"CONSTRUCTION",role:"LEADING",mechanisms:["future-supply","employment"],targetStates:["DECELERATION","CORRECTION","RECOVERY"],defaultReliability:.84,defaultFreshnessDays:60,recommendedWeight:.8},
  {family:"INCOME",role:"LEADING",mechanisms:["affordability","demand"],targetStates:["ACCELERATION","DECELERATION"],defaultReliability:.86,defaultFreshnessDays:60,recommendedWeight:.75},
  {family:"EMPLOYMENT",role:"LEADING",mechanisms:["income","forced-sale-risk"],targetStates:["DECELERATION","CORRECTION","LIQUIDITY_CRISIS"],defaultReliability:.9,defaultFreshnessDays:30,recommendedWeight:.85},
  {family:"INFRASTRUCTURE",role:"LEADING",mechanisms:["accessibility","amenity-capitalization"],targetStates:["ACCELERATION","RECOVERY"],defaultReliability:.8,defaultFreshnessDays:180,recommendedWeight:.7},
  {family:"DEMOGRAPHY",role:"LEADING",mechanisms:["household-formation","migration"],targetStates:["ACCELERATION","DECELERATION"],defaultReliability:.92,defaultFreshnessDays:365,recommendedWeight:.65},
  {family:"TRANSACTION",role:"COINCIDENT",mechanisms:["realized-demand"],targetStates:["ACCELERATION","SOFT_LANDING","DECELERATION","CORRECTION","RECOVERY"],defaultReliability:.98,defaultFreshnessDays:90,recommendedWeight:1},
  {family:"RENT",role:"COINCIDENT",mechanisms:["cashflow","housing-demand"],targetStates:["ACCELERATION","DECELERATION","RECOVERY"],defaultReliability:.9,defaultFreshnessDays:45,recommendedWeight:.9},
  {family:"ENERGY",role:"COINCIDENT",mechanisms:["household-cost","construction-cost"],targetStates:["DECELERATION","CORRECTION"],defaultReliability:.82,defaultFreshnessDays:14,recommendedWeight:.65},
  {family:"POLICY",role:"COINCIDENT",mechanisms:["credit-conditions","tax-regulation"],targetStates:["ACCELERATION","DECELERATION","LIQUIDITY_CRISIS"],defaultReliability:.95,defaultFreshnessDays:14,recommendedWeight:.95},
  {family:"MACRO",role:"LAGGING",mechanisms:["business-cycle"],targetStates:["ACCELERATION","SOFT_LANDING","DECELERATION","CORRECTION"],defaultReliability:.9,defaultFreshnessDays:30,recommendedWeight:.7},
  {family:"SENTIMENT",role:"LAGGING",mechanisms:["expectations"],targetStates:["ACCELERATION","CORRECTION"],defaultReliability:.5,defaultFreshnessDays:7,recommendedWeight:.45},
];

export function getSignalOntology(family:EvidenceFamily):SignalOntologyEntry{
  return FUTURE_SIGNAL_ONTOLOGY.find(x=>x.family===family)??{
    family,role:"LAGGING",mechanisms:[],targetStates:[],defaultReliability:.4,
    defaultFreshnessDays:30,recommendedWeight:.4
  };
}

export function rankSignalFamilies():SignalOntologyEntry[]{
  return [...FUTURE_SIGNAL_ONTOLOGY].sort((a,b)=>
    (b.recommendedWeight*b.defaultReliability)-
    (a.recommendedWeight*a.defaultReliability)
  );
}
