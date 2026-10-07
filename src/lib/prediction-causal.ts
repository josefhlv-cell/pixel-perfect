/**
 * Reality Investor — Causal Market Graph.
 *
 * Structural scenario engine, not a causal identification claim.
 * Coefficients are explicit assumptions and must be calibrated against
 * transaction data before being presented as estimated causal effects.
 */

export type CausalNode =
  | "POLICY_RATE" | "MORTGAGE_RATE" | "AFFORDABILITY" | "CREDIT"
  | "INCOME" | "EMPLOYMENT" | "DEMAND" | "INVENTORY"
  | "DOM" | "NEGOTIATION_POWER" | "TRANSACTIONS" | "PRICE"
  | "RENT" | "CONSTRUCTION";

export interface CausalEdge {
  from: CausalNode;
  to: CausalNode;
  elasticity: number;
  lagMonths: number;
  confidence: number;
  mechanism: string;
}

export interface CausalGraph {
  nodes: CausalNode[];
  edges: CausalEdge[];
}

export interface CausalState {
  node: CausalNode;
  baseline: number;
  shock: number;
  propagated: number;
  confidence: number;
  horizonMonths: number;
}

export interface CausalScenario {
  horizonMonths: number;
  intervention: Partial<Record<CausalNode, number>>;
  states: CausalState[];
  priceImpactBps: number;
  transactionImpactBps: number;
  liquidityImpactBps: number;
  dominantPath: CausalNode[];
  caveat: string;
}

const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));

export const DEFAULT_CAUSAL_GRAPH: CausalGraph = {
  nodes: [
    "POLICY_RATE","MORTGAGE_RATE","AFFORDABILITY","CREDIT","INCOME",
    "EMPLOYMENT","DEMAND","INVENTORY","DOM","NEGOTIATION_POWER",
    "TRANSACTIONS","PRICE","RENT","CONSTRUCTION"
  ],
  edges: [
    {from:"POLICY_RATE",to:"MORTGAGE_RATE",elasticity:0.72,lagMonths:2,confidence:0.86,mechanism:"přenos měnové politiky do financování"},
    {from:"MORTGAGE_RATE",to:"AFFORDABILITY",elasticity:-0.80,lagMonths:1,confidence:0.90,mechanism:"splátka a úvěrová kapacita domácnosti"},
    {from:"AFFORDABILITY",to:"DEMAND",elasticity:0.68,lagMonths:2,confidence:0.78,mechanism:"kupní síla a aktivní poptávka"},
    {from:"CREDIT",to:"DEMAND",elasticity:0.48,lagMonths:1,confidence:0.70,mechanism:"dostupnost úvěru"},
    {from:"INCOME",to:"AFFORDABILITY",elasticity:0.42,lagMonths:2,confidence:0.70,mechanism:"příjmová kapacita"},
    {from:"EMPLOYMENT",to:"DEMAND",elasticity:0.44,lagMonths:3,confidence:0.74,mechanism:"jistota příjmu"},
    {from:"CONSTRUCTION",to:"INVENTORY",elasticity:0.62,lagMonths:6,confidence:0.72,mechanism:"nová nabídka"},
    {from:"DEMAND",to:"INVENTORY",elasticity:-0.40,lagMonths:1,confidence:0.72,mechanism:"rychlost absorpce nabídky"},
    {from:"INVENTORY",to:"DOM",elasticity:0.70,lagMonths:1,confidence:0.82,mechanism:"zásoba a doba prodeje"},
    {from:"DOM",to:"NEGOTIATION_POWER",elasticity:0.62,lagMonths:1,confidence:0.80,mechanism:"čas na trhu zvyšuje prostor pro vyjednávání kupujícího"},
    {from:"NEGOTIATION_POWER",to:"PRICE",elasticity:-0.34,lagMonths:2,confidence:0.65,mechanism:"vyjednávací tlak"},
    {from:"DEMAND",to:"TRANSACTIONS",elasticity:0.72,lagMonths:1,confidence:0.82,mechanism:"objem poptávky"},
    {from:"INVENTORY",to:"TRANSACTIONS",elasticity:0.35,lagMonths:1,confidence:0.62,mechanism:"dostupnost jednotek"},
    {from:"TRANSACTIONS",to:"PRICE",elasticity:0.28,lagMonths:3,confidence:0.66,mechanism:"clearing price a tržní obrat"},
    {from:"RENT",to:"PRICE",elasticity:0.20,lagMonths:3,confidence:0.58,mechanism:"kapitalizace nájemního cash-flow"},
  ]
};

export function propagateCausalShock(
  graph: CausalGraph,
  baseline: Partial<Record<CausalNode, number>>,
  intervention: Partial<Record<CausalNode, number>>,
  horizonMonths: number,
): CausalScenario {
  const values = new Map<CausalNode,number>(graph.nodes.map(n=>[n,baseline[n]??0]));
  const direct = new Map<CausalNode,number>(graph.nodes.map(n=>[n,intervention[n]??0]));
  const confidence = new Map<CausalNode,number>(graph.nodes.map(n=>[n, intervention[n]!=null ? 1 : 0]));
  const pathScore = new Map<CausalNode,number>(graph.nodes.map(n=>[n, Math.abs(intervention[n]??0)]));

  for(let step=0; step<Math.max(1,horizonMonths); step++){
    for(const edge of graph.edges){
      if(edge.lagMonths>step+1) continue;
      const source = (direct.get(edge.from)??0);
      const transmitted = source * edge.elasticity * edge.confidence / Math.max(1,edge.lagMonths);
      if(Math.abs(transmitted)<0.0001) continue;
      direct.set(edge.to,(direct.get(edge.to)??0)+transmitted);
      confidence.set(edge.to,Math.max(confidence.get(edge.to)??0,edge.confidence));
      pathScore.set(edge.to,(pathScore.get(edge.to)??0)+Math.abs(transmitted));
    }
  }

  const states=CausalNodeList(graph).map(node=>({
    node,
    baseline:baseline[node]??0,
    shock:intervention[node]??0,
    propagated:Math.round((direct.get(node)??0)*100)/100,
    confidence:clamp(confidence.get(node)??0,0,1),
    horizonMonths
  }));
  const priceImpact=clamp(direct.get("PRICE")??0,-10000,10000);
  const transactionImpact=clamp(direct.get("TRANSACTIONS")??0,-10000,10000);
  const liquidityImpact=clamp((direct.get("INVENTORY")??0)*0.35+(direct.get("DOM")??0)*0.45,-10000,10000);
  const dominantPath=[...pathScore.entries()].sort((a,b)=>b[1]-a[1]).map(([n])=>n).slice(0,6);

  return {
    horizonMonths, intervention, states,
    priceImpactBps:Math.round(priceImpact),
    transactionImpactBps:Math.round(transactionImpact),
    liquidityImpactBps:Math.round(liquidityImpact),
    dominantPath,
    caveat:"Strukturální counterfactual; není to identifikovaný kauzální efekt. Koeficienty musí být kalibrovány na transakčních datech."
  };
}

function CausalNodeList(graph:CausalGraph):CausalNode[]{ return graph.nodes; }

export function locateMarketInCausalChain(state:Partial<Record<CausalNode,number>>):{
  phase:"FINANCING"|"DEMAND"|"SUPPLY"|"LIQUIDITY"|"PRICE_DISCOVERY"|"BALANCED";
  evidence:string[];
}{
  const rate=state.MORTGAGE_RATE??0, aff=state.AFFORDABILITY??0, demand=state.DEMAND??0;
  const inventory=state.INVENTORY??0, dom=state.DOM??0, price=state.PRICE??0;
  if(rate>5000 && aff<0) return {phase:"FINANCING",evidence:["financování je hlavní brzda","dostupnost bydlení se zhoršuje"]};
  if(demand>2500 && inventory<0) return {phase:"DEMAND",evidence:["poptávka převyšuje nabídku","zásoba se absorbuje"]};
  if(inventory>2500 || dom>2500) return {phase:"SUPPLY",evidence:["nabídka nebo DOM roste","kupující získává vyjednávací prostor"]};
  if(dom>1200 && price<0) return {phase:"LIQUIDITY",evidence:["likvidita slábne","cena začíná reagovat se zpožděním"]};
  if(Math.abs(price)>1500) return {phase:"PRICE_DISCOVERY",evidence:["cena se výrazně odchyluje od rovnováhy"]};
  return {phase:"BALANCED",evidence:["signály jsou relativně vyvážené"]};
}
