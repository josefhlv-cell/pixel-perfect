/**
 * Reality Investor — Deal Digital Twin.
 *
 * A property is treated as a dynamic system rather than a single price:
 * purchase -> financing -> rent -> vacancy -> capex -> refinancing -> exit.
 *
 * The twin produces distributions over paths and identifies the variables that
 * can break the investment thesis. It is intentionally a structural simulator;
 * probabilities become empirical only after point-in-time historical replay.
 */

export type TwinPathKind="BASE"|"RATE_SHOCK"|"RECESSION"|"RENT_BOOM"|"VACANCY_SHOCK"|"EXIT_FREEZE";
export type TwinDecision="BUY_NOW"|"NEGOTIATE"|"WAIT"|"PASS";

export interface DealTwinInput {
  purchasePrice:number;
  areaM2:number;
  monthlyRent:number;
  equity:number;
  mortgageRate:number;
  mortgageYears:number;
  holdingYears:number;
  vacancyRate:number;
  operatingCostRate:number;
  maintenancePerM2Annual:number;
  annualRentGrowth:number;
  annualPriceGrowth:number;
  saleCostRate:number;
  acquisitionCostRate:number;
  taxRate:number;
  capexReserve:number;
}

export interface TwinIntervention {
  kind:"PRICE"|"RATE"|"RENT"|"VACANCY"|"EXIT"|"HOLDING_PERIOD";
  delta:number;
}

export interface TwinPath {
  id:string;
  kind:TwinPathKind;
  annualPriceGrowth:number;
  annualRentGrowth:number;
  mortgageRateDelta:number;
  vacancyDelta:number;
  exitLiquidity:number;
  probabilityWeight:number;
}

export interface TwinYear {
  year:number;
  propertyValue:number;
  debtBalance:number;
  rentGross:number;
  vacancyCost:number;
  operatingCosts:number;
  maintenance:number;
  interest:number;
  principal:number;
  cashFlowBeforeSale:number;
  equityValue:number;
}

export interface TwinOutcome {
  pathId:string;
  totalCashFlow:number;
  totalEquity:number;
  exitProceeds:number;
  investedEquity:number;
  multiple:number;
  irr:number;
  maxDrawdown:number;
  breakEvenYear:number|null;
  survives:boolean;
  years:TwinYear[];
}

export interface DealDigitalTwinResult {
  decision:TwinDecision;
  expectedIrr:number;
  medianIrr:number;
  probabilityPositive:number;
  probabilityLoss:number;
  p10Irr:number;
  p90Irr:number;
  worstIrr:number;
  bestIrr:number;
  expectedEquityMultiple:number;
  maxDrawdownP90:number;
  pathOutcomes:TwinOutcome[];
  breakpoints:{
    kind:TwinIntervention["kind"];
    threshold:number;
    resultingDecision:TwinDecision;
  }[];
  dominantRisks:string[];
  audit:string[];
}

const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));

function quantile(xs:number[],q:number):number{
  if(!xs.length)return 0;
  const a=[...xs].sort((x,y)=>x-y);
  const p=clamp(q,0,1)*(a.length-1);
  const lo=Math.floor(p),hi=Math.ceil(p);
  return a[lo]!+(a[hi]!-a[lo]!)*(p-lo);
}

function annualDebtPayment(principal:number,rate:number,years:number):number{
  if(principal<=0||years<=0)return 0;
  if(rate===0)return principal/years;
  const n=years*12,r=rate/12;
  return principal*r*Math.pow(1+r,n)/(Math.pow(1+r,n)-1);
}

function simulatePath(input:DealTwinInput,path:TwinPath):TwinOutcome{
  const debt=Math.max(0,input.purchasePrice*(1-input.equity/input.purchasePrice));
  const monthlyPayment=annualDebtPayment(debt,Math.max(0,pathMortgage(input.mortgageRate,path.mortgageRateDelta)),input.mortgageYears)/12;
  let balance=debt;
  let value=input.purchasePrice;
  let rent=input.monthlyRent;
  let invested=input.equity+input.purchasePrice*input.acquisitionCostRate;
  let cumulative=0;
  let peak=0;
  let maxDrawdown=0;
  let breakEvenYear:null|number=null;
  const years:TwinYear[]=[];

  for(let year=1;year<=input.holdingYears;year++){
    value*=1+path.annualPriceGrowth;
    rent*=1+path.annualRentGrowth;

    let interest=0,principalPaid=0;
    for(let m=0;m<12;m++){
      const monthlyRate=Math.max(0,pathMortgage(input.mortgageRate,path.mortgageRateDelta))/12;
      interest+=balance*monthlyRate;
      const principal=Math.max(0,Math.min(balance,monthlyPayment-balance*monthlyRate));
      principalPaid+=principal;
      balance-=principal;
    }

    const gross=rent*12;
    const vacancy=gross*clamp(input.vacancyRate+path.vacancyDelta,0,.75);
    const operating=Math.max(0,gross-vacancy)*input.operatingCostRate;
    const maintenance=input.maintenancePerM2Annual*input.areaM2;
    const capex=input.capexReserve*input.purchasePrice;
    const cashFlow=gross-vacancy-operating-maintenance-capex-interest-principalPaid;
    cumulative+=cashFlow;

    const equityValue=value-balance;
    const markToMarket=cumulative+equityValue-invested;
    peak=Math.max(peak,markToMarket);
    maxDrawdown=Math.max(maxDrawdown,peak-markToMarket);
    if(breakEvenYear===null&&markToMarket>=0)breakEvenYear=year;

    years.push({year,propertyValue:value,debtBalance:balance,rentGross:gross,
      vacancyCost:vacancy,operatingCosts:operating,maintenance,interest,
      principal:principalPaid,cashFlowBeforeSale:cashFlow,equityValue});
  }

  const final=years.at(-1)!;
  const exitLiquidity=clamp(path.exitLiquidity,0,1);
  const exitProceeds=final.propertyValue*(1-input.saleCostRate)*exitLiquidity-final.debtBalance;
  const totalCashFlow=cumulative+exitProceeds;
  const multiple=invested>0?(totalCashFlow+invested)/invested:0;
  const annual=Math.max(1,input.holdingYears);
  const irr=Math.pow(Math.max(.0001,multiple),1/annual)-1;
  return {pathId:path.id,totalCashFlow,totalEquity:final.equityValue,exitProceeds,
    investedEquity:invested,multiple,irr,maxDrawdown,breakEvenYear,survives:exitProceeds>=0,years};
}

function pathMortgage(rate:number,delta:number):number{
  return Math.max(0,rate+delta);
}

function decision(x:{irr:number,probabilityPositive:number,drawdown:number}):TwinDecision{
  if(x.irr>=.10&&x.probabilityPositive>=.70&&x.drawdown<.25)return "BUY_NOW";
  if(x.irr>=.06&&x.probabilityPositive>=.55)return "NEGOTIATE";
  if(x.irr>=0)return "WAIT";
  return "PASS";
}

export function dealDigitalTwin(
  input:DealTwinInput,
  paths:TwinPath[]=[
    {id:"BASE",kind:"BASE",annualPriceGrowth:input.annualPriceGrowth,annualRentGrowth:input.annualRentGrowth,mortgageRateDelta:0,vacancyDelta:0,exitLiquidity:.90,probabilityWeight:.35},
    {id:"RATE_SHOCK",kind:"RATE_SHOCK",annualPriceGrowth:input.annualPriceGrowth-.03,annualRentGrowth:input.annualRentGrowth-.005,mortgageRateDelta:.02,vacancyDelta:.03,exitLiquidity:.75,probabilityWeight:.15},
    {id:"RECESSION",kind:"RECESSION",annualPriceGrowth:input.annualPriceGrowth-.08,annualRentGrowth:input.annualRentGrowth-.02,mortgageRateDelta:.015,vacancyDelta:.10,exitLiquidity:.55,probabilityWeight:.10},
    {id:"RENT_BOOM",kind:"RENT_BOOM",annualPriceGrowth:input.annualPriceGrowth+.02,annualRentGrowth:input.annualRentGrowth+.03,mortgageRateDelta:-.01,vacancyDelta:-.02,exitLiquidity:.95,probabilityWeight:.15},
    {id:"VACANCY_SHOCK",kind:"VACANCY_SHOCK",annualPriceGrowth:input.annualPriceGrowth-.02,annualRentGrowth:input.annualRentGrowth-.01,mortgageRateDelta:.005,vacancyDelta:.18,exitLiquidity:.65,probabilityWeight:.10},
    {id:"EXIT_FREEZE",kind:"EXIT_FREEZE",annualPriceGrowth:input.annualPriceGrowth,annualRentGrowth:input.annualRentGrowth,mortgageRateDelta:0,vacancyDelta:.04,exitLiquidity:.25,probabilityWeight:.15},
  ]
):DealDigitalTwinResult{
  if(!(input.purchasePrice>0&&input.monthlyRent>=0&&input.areaM2>0&&input.equity>0)){
    return {
      decision:"PASS",expectedIrr:0,medianIrr:0,probabilityPositive:0,probabilityLoss:1,
      p10Irr:0,p90Irr:0,worstIrr:0,bestIrr:0,expectedEquityMultiple:0,maxDrawdownP90:1,
      pathOutcomes:[],breakpoints:[],dominantRisks:["Nedostatečné vstupy pro simulaci."],
      audit:["Digital Twin blocked: invalid financial inputs."]
    };
  }

  const normalized=paths.map(p=>({...p,probabilityWeight:Math.max(0,p.probabilityWeight)}));
  const totalWeight=normalized.reduce((s,p)=>s+p.probabilityWeight,0)||1;
  const weighted=normalized.map(p=>({...p,probabilityWeight:p.probabilityWeight/totalWeight}));
  const outcomes=weighted.map(p=>simulatePath(input,p));
  const irrs=outcomes.map(o=>o.irr);
  const expectedIrr=outcomes.reduce((s,o,i)=>s+o.irr*weighted[i]!.probabilityWeight,0);
  const positiveWeight=outcomes.reduce((s,o,i)=>s+(o.irr>0?weighted[i]!.probabilityWeight:0),0);
  const lossWeight=1-positiveWeight;
  const drawdowns=outcomes.map(o=>o.maxDrawdown);
  const expectedMultiple=outcomes.reduce((s,o,i)=>s+o.multiple*weighted[i]!.probabilityWeight,0);
  const drawdownP90=quantile(drawdowns,.90);
  const action=decision({irr:expectedIrr,probabilityPositive:positiveWeight,drawdown:drawdownP90});

  const breakpoints:{kind:TwinIntervention["kind"];threshold:number;resultingDecision:TwinDecision}[]=[];
  const evaluateDecision=(x:DealTwinInput):TwinDecision=>{
    const localOutcomes=weighted.map(p=>simulatePath(x,p));
    const localIrr=localOutcomes.reduce((s,o,i)=>s+o.irr*weighted[i]!.probabilityWeight,0);
    const localPositive=localOutcomes.reduce((s,o,i)=>s+(o.irr>0?weighted[i]!.probabilityWeight:0),0);
    const localDrawdown=quantile(localOutcomes.map(o=>o.maxDrawdown),.90);
    return decision({irr:localIrr,probabilityPositive:localPositive,drawdown:localDrawdown});
  };
  const interventions:TwinIntervention[]=[
    {kind:"PRICE",delta:-.20},{kind:"PRICE",delta:.10},
    {kind:"RATE",delta:.03},{kind:"RENT",delta:-.15},
    {kind:"VACANCY",delta:.15},{kind:"EXIT",delta:-.40},
  ];
  for(const intervention of interventions){
    const x={...input};
    if(intervention.kind==="PRICE"){
      x.purchasePrice*=1+intervention.delta;
      x.equity=Math.min(x.equity,x.purchasePrice*.95);
    }
    if(intervention.kind==="RATE")x.mortgageRate+=intervention.delta;
    if(intervention.kind==="RENT")x.monthlyRent*=1+intervention.delta;
    if(intervention.kind==="VACANCY")x.vacancyRate+=intervention.delta;
    if(intervention.kind==="EXIT")x.saleCostRate+=Math.abs(intervention.delta);
    breakpoints.push({kind:intervention.kind,threshold:intervention.delta,resultingDecision:evaluateDecision(x)});
  }

  const risks:string[]=[];
  if(drawdownP90>.25)risks.push("Vysoký P90 drawdown kapitálu.");
  if(lossWeight>.35)risks.push("Významná část scénářů končí záporným IRR.");
  if(outcomes.some(o=>o.exitProceeds<0))risks.push("V některých scénářích nestačí výnos z prodeje na splacení dluhu.");
  if(input.vacancyRate>.10)risks.push("Výchozí vacancy je vysoká.");
  if(input.mortgageRate>.06)risks.push("Financování je citlivé na úrokový režim.");

  return {
    decision:action,expectedIrr,medianIrr:quantile(irrs,.5),
    probabilityPositive:positiveWeight,probabilityLoss:lossWeight,
    p10Irr:quantile(irrs,.1),p90Irr:quantile(irrs,.9),
    worstIrr:Math.min(...irrs),bestIrr:Math.max(...irrs),
    expectedEquityMultiple:expectedMultiple,maxDrawdownP90:drawdownP90,
    pathOutcomes:outcomes,breakpoints,dominantRisks:risks,
    audit:[
      "Digital Twin is a structural scenario simulator, not an empirically calibrated probability model.",
      "IRR includes modeled operating cash flow, debt amortization and exit proceeds.",
      "Scenario weights are priors until calibrated against historical deal outcomes.",
      "Taxes, refinancing fees and jurisdiction-specific accounting may require a separate verified module.",
    ],
  };
}
